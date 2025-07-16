import './instruments.js';

import * as Sentry from '@sentry/node';

import express from 'express';
import session from 'express-session';
import dotenv from 'dotenv';
import { fetchTokenWithAccessCode } from './helper.js';
import { oauthMetadata, authorize, callback, jiraIssues, register } from './oauth.js';
import { mcp, setAuthContext, clearAuthContext } from './mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import cors from 'cors';
import { logger } from './logger.js';

// configurations
dotenv.config();

// Boot express
const app = express();
const port = process.env.PORT || 3000;

// Sentry setup needs to be done before the middlewares
Sentry.setupExpressErrorHandler(app);

// Session middleware for OAuth flows
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'changeme',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true in production with HTTPS
  }),
);

app.use(cors());

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Error handler middleware
app.use(function onError(err, req, res, next) {
  // Todo: do we want a page for this?
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

// --- OAuth Endpoints ---
app.get('/.well-known/oauth-authorization-server', oauthMetadata);

// OAuth 2.0 Protected Resource Metadata (RFC9728) for MCP discovery
app.get('/.well-known/oauth-protected-resource', (req, res) => {
  console.log('🔍 OAuth Protected Resource Metadata requested!', {
    headers: req.headers,
    query: req.query,
  });
  const baseUrl = `http://localhost:${port}`;
  const metadata = {
    resource: baseUrl,
    authorization_servers: [`${baseUrl}/.well-known/oauth-authorization-server`],
    bearer_methods_supported: ['header', 'query'],
    resource_documentation: `${baseUrl}`,
    scopes_supported: ['read:jira-work', 'offline_access'],
    scope_documentation: {
      'read:jira-work': 'Access to read Jira issues and sites',
      offline_access: 'Refresh token access',
    },
  };
  console.log('📤 Sending protected resource metadata:', metadata);
  res.json(metadata);
});

app.get('/authorize', authorize);
app.post('/register', express.json(), register);
app.get('/callback', callback);
app.get('/jira-issues', jiraIssues);

// Map to store transports by session ID
const transports = {};

// --- MCP HTTP Endpoints ---
// Handle POST requests for client-to-server communication
app.post('/mcp', async (req, res) => {
  console.log('=== MCP POST REQUEST ===');
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('========================');

  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'];
  let transport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing transport
    transport = transports[sessionId];
    console.log(`Reusing existing transport for session: ${sessionId}`);
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New initialization request
    console.log('New MCP initialization request');

    // Extract auth info
    let authInfo = null;
    const auth = req.headers.authorization;
    const tokenFromQuery = req.query.token;

    if (auth && auth.startsWith('Bearer ')) {
      try {
        const token = auth.slice('Bearer '.length);
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
        authInfo = payload;
        console.log('Successfully parsed JWT payload:', authInfo);

        // Validate that we have an Atlassian access token
        if (!authInfo.atlassian_access_token) {
          console.log('JWT payload missing atlassian_access_token');
          return res
            .status(401)
            .header(
              'WWW-Authenticate',
              `Bearer realm="mcp", resource_metadata_url="http://localhost:${port}/.well-known/oauth-protected-resource"`,
            )
            .json({
              jsonrpc: '2.0',
              error: {
                code: -32001,
                message: 'Authentication token missing Atlassian access token',
              },
              id: req.body.id || null,
            });
        }
      } catch (err) {
        logger.error('Error parsing JWT token from header:', err);
        return res
          .status(401)
          .header(
            'WWW-Authenticate',
            `Bearer realm="mcp", resource_metadata_url="http://localhost:${port}/.well-known/oauth-protected-resource"`,
          )
          .json({ error: 'Invalid token' });
      }
    } else if (tokenFromQuery) {
      try {
        const payload = JSON.parse(Buffer.from(tokenFromQuery.split('.')[1], 'base64url').toString());
        authInfo = payload;
        console.log('Successfully parsed JWT payload from query:', authInfo);

        // Validate that we have an Atlassian access token
        if (!authInfo.atlassian_access_token) {
          console.log('JWT payload from query missing atlassian_access_token');
          return res
            .status(401)
            .header(
              'WWW-Authenticate',
              `Bearer realm="mcp", resource_metadata_url="http://localhost:${port}/.well-known/oauth-protected-resource"`,
            )
            .json({
              jsonrpc: '2.0',
              error: {
                code: -32001,
                message: 'Authentication token missing Atlassian access token',
              },
              id: req.body.id || null,
            });
        }
      } catch (err) {
        logger.error('Error parsing JWT token from query:', err);
        return res
          .status(401)
          .header(
            'WWW-Authenticate',
            `Bearer realm="mcp", resource_metadata_url="http://localhost:${port}/.well-known/oauth-protected-resource"`,
          )
          .json({ error: 'Invalid token' });
      }
    } else {
      // No authentication provided - require authentication immediately
      console.log('No authentication provided - requiring authentication for session initialization');
      return res
        .status(401)
        .header(
          'WWW-Authenticate',
          `Bearer realm="mcp", resource_metadata_url="http://localhost:${port}/.well-known/oauth-protected-resource"`,
        )
        .json({
          jsonrpc: '2.0',
          error: {
            code: -32001,
            message: 'Authentication required. Please authenticate with Jira first.',
          },
          id: req.body.id || null,
        });
    }

    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (newSessionId) => {
        // Store the transport by session ID
        transports[newSessionId] = transport;
        console.log(`Transport stored for session: ${newSessionId}`);

        // Store auth context for this session
        setAuthContext(newSessionId, authInfo);
      },
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        console.log(`Cleaning up session: ${transport.sessionId}`);
        delete transports[transport.sessionId];
        clearAuthContext(transport.sessionId);
      }
    };

    // Connect the MCP server to this transport
    await mcp.connect(transport);
    console.log('MCP server connected to new transport');
  } else {
    // Invalid request
    console.log('Invalid MCP request - no session ID and not an initialize request');
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  // Handle the request
  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }

  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

// --- Existing Endpoints ---

app.get('/access-token', async (req, res) => {
  try {
    const code = req.query.code;
    const refresh = req.query.refresh;
    let data = {};
    if (!code) throw new Error('No Access code provided');
    const { error, data: accessData, message } = await fetchTokenWithAccessCode(code, refresh);
    if (error) {
      //handle properly
      return res.status(400).json({
        error: true,
        message,
      });
    } else {
      data = accessData;
    }
    return res.json({
      error: false,
      ...data,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      error: true,
      message: `${error.message}`,
    });
  }
});

app.post('/domain', async (req, res) => {
  logger.info(`[domain] - ${req.body.domain}`);

  res.status(204).send();
});

// Start server
app.listen(port, () => console.log(`Server is listening on port ${port}!`));

// Handle unhandled promise rejections and exceptions
process.on('unhandledRejection', (err) => {
  console.log(err);
  Sentry.captureException(err);
});

process.on('uncaughtException', (err) => {
  console.log(err.message);
  Sentry.captureException(err);
});
