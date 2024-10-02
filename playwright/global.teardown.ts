import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const originalPath = path.join(__dirname, '../.env.original');
const destinationPath = path.join(__dirname, '../.env');

teardown('restore-env-variables', async ({ }, testInfo) => {
  console.log('Current folder path:', __dirname);
  console.log('Restoring original .env file from:', originalPath, 'to:', destinationPath);
  fs.copyFileSync(originalPath, destinationPath);
  console.log('Removing backup .env file:', originalPath);
  fs.unlinkSync(originalPath);
});