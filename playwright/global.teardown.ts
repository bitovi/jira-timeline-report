import { test as teardown } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const originalPath = path.join(__dirname, '../.env.original');
const destinationPath = path.join(__dirname, '../.env');

teardown('restore-env-variables', async ({ }, testInfo) => {
  console.log("Restoring original .env file");
  fs.copyFileSync(originalPath, destinationPath);
  fs.unlinkSync(originalPath);
});