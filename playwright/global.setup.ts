import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const originalPath = path.join(__dirname, '../.env');
const backupPath = path.join(__dirname, '../.env.original');
const playwrightEnvPath = path.join(__dirname, '.env.playwright');

setup('set-env-variables', async ({ }, testInfo) => {
    console.log("Setting up .env file for testing");
    fs.copyFileSync(originalPath, backupPath);
    fs.copyFileSync(playwrightEnvPath, originalPath);
});