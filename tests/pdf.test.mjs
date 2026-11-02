import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

test('PDF Security: createMultiPageTarqaPdf is disabled and throws error', async () => {
  const servicePath = path.resolve('src/lib/fileStorageService.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  // Verify createMultiPageTarqaPdf does not contain PDFDocument.create()
  assert.equal(
    content.includes('PDFDocument.create()'),
    false,
    'PDFDocument.create() must not exist anywhere in fileStorageService.ts'
  );

  // Verify createMultiPageTarqaPdf throws error
  assert.match(
    content,
    /export const createMultiPageTarqaPdf\s*=\s*async\s*\(\):\s*Promise<Uint8Array>\s*=>\s*\{[\s\S]*?throw new Error/,
    'createMultiPageTarqaPdf must throw an error indicating it is disabled'
  );
});

test('PDF Security: getWatermarkedPdfBlob throws error if no original file is uploaded', async () => {
  const servicePath = path.resolve('src/lib/fileStorageService.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  // Verify that empty or dummy urls are rejected
  assert.match(
    content,
    /if\s*\(!url\s*\|\|\s*url\.trim\(\)\s*===\s*''\s*\|\|\s*url\.includes\('tarqa\.app\/files\/'\)\)/,
    'getWatermarkedPdfBlob must reject missing or dummy URLs upfront'
  );

  // Verify that it never falls back to generating synthetic PDF
  assert.match(
    content,
    /throw new Error\('لم يتم العثور على ملف أصلي مرفوع لهذه المذكرة\. يرجى رفع الملف من قبل المدرس أو الإدارة\.'\)/,
    'Must throw clear error when original file bytes are missing'
  );
});

test('PDF Security: downloadWatermarkedFile does not synthesize fake PDFs', async () => {
  const servicePath = path.resolve('src/lib/fileStorageService.ts');
  const content = fs.readFileSync(servicePath, 'utf8');

  // Must not call createMultiPageTarqaPdf inside downloadWatermarkedFile
  const dlFnMatch = content.match(/export const downloadWatermarkedFile =[\s\S]*?export const getWatermarkedPdfBlobUrl/);
  assert.ok(dlFnMatch, 'downloadWatermarkedFile must exist');
  assert.equal(
    dlFnMatch[0].includes('createMultiPageTarqaPdf'),
    false,
    'downloadWatermarkedFile must never call createMultiPageTarqaPdf'
  );
});

test('CoursesView & LecturesCMS: No dummy placeholder URLs generated on save', async () => {
  const coursesViewPath = path.resolve('src/components/CoursesView.tsx');
  const cmsPath = path.resolve('src/components/LecturesCMS.tsx');

  const coursesContent = fs.readFileSync(coursesViewPath, 'utf8');
  const cmsContent = fs.readFileSync(cmsPath, 'utf8');

  // CoursesView must not fall back to foundation.pdf
  assert.equal(
    coursesContent.includes("'https://tarqa.app/files/foundation.pdf'"),
    false,
    'CoursesView must not use foundation.pdf fallback'
  );

  // LecturesCMS must not generate synthetic tarqa.app/files url
  assert.equal(
    cmsContent.includes('https://tarqa.app/files/tarqa_'),
    false,
    'LecturesCMS must not generate dummy tarqa.app/files/tarqa_ file URLs'
  );
});

test('subscriptionService: getFiles sanitizes legacy tarqa.app/files dummy URLs', async () => {
  const subServicePath = path.resolve('src/lib/subscriptionService.ts');
  const content = fs.readFileSync(subServicePath, 'utf8');

  assert.match(
    content,
    /f\.fileUrl\s*&&\s*f\.fileUrl\.includes\('tarqa\.app\/files\/'\)\s*\?\s*''\s*:\s*f\.fileUrl/,
    'getFiles must sanitize legacy tarqa.app/files URLs to empty string'
  );
});
