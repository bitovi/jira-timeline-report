import './instruments.js';

import * as Sentry from '@sentry/node';

import express from 'express';
import dotenv from 'dotenv';
import { fetchTokenWithAccessCode } from './helper.js';
import cors from 'cors';
import { logger } from './logger.js';

// configurations
dotenv.config();

// Boot express
const app = express();
const port = process.env.PORT || 3000;

// Sentry setup needs to be done before the middlewares
Sentry.setupExpressErrorHandler(app);

app.use(cors());

// middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use(function onError(err, req, res, next) {
  // Todo: do we want a page for this?
  res.statusCode = 500;
  res.end(res.sentry + '\n');
});

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
