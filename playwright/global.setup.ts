import { test as setup } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

const originalPath = path.join(__dirname, '../.env');
const backupPath = path.join(__dirname, '../.env.original');
const playwrightEnvPath = path.join(__dirname, '.env.playwright');

setup('set-env-variables', async ({ }, testInfo) => {
    console.log('Current folder path:', __dirname);
    console.log('Backing up original .env:', originalPath, ' file to:', backupPath);
    fs.copyFileSync(originalPath, backupPath);
    console.log('Copying .env file from:', playwrightEnvPath, 'to:', originalPath);
    fs.copyFileSync(playwrightEnvPath, originalPath);
});