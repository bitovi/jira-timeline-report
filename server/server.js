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

app.post('/api/user-details', async (req, res) => {
  try {
    const { first, last } = req.body;

    // Validate input
    if (!first || !last) {
      return res.status(400).json({
        success: false,
        message: 'Both first and last name are required.',
      });
    }

    if (typeof first !== 'string' || typeof last !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'First and last name must be strings.',
      });
    }

    if (first.trim().length === 0 || last.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'First and last name cannot be empty.',
      });
    }

    if (first.length > 50 || last.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'First and last name must be less than 50 characters.',
      });
    }

    logger.info(`[user-details] - ${first} ${last}`);

    // Simulate potential server error for testing (10% chance)
    if (Math.random() < 0.1) {
      throw new Error('Simulated server error');
    }

    // In a real application, you would save this to a database
    // For now, we just log it and return success
    res.json({
      success: true,
      message: 'User details saved successfully.',
    });
  } catch (error) {
    console.error('Error saving user details:', error);
    Sentry.captureException(error);
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.',
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
