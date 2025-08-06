require('dotenv').config();
const { Worker } = require('bullmq');
const path = require('path');
const fs = require('fs');
const pdf = require('pdf-parse');
const XLSX = require('xlsx');

const connection = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
  maxRetriesPerRequest: null
};

console.log('🟢 Worker iniciado. Aguardando jobs...');

const worker = new Worker('convert-pdf', async job => {
  console.log(`📥 Job recebido: ${job.id}`);
  
  const { filePath, outputFilename } = job.data;
  console.log(`📄 Lendo arquivo: ${filePath}`);

  const dataBuffer = fs.readFileSync(filePath);

  const pdfData = await pdf(dataBuffer);
  console.log('✅ Texto extraído do PDF');

  const rows = pdfData.text.split('\n').map((line, i) => [i + 1, line]);

  const worksheet = XLSX.utils.aoa_to_sheet([['Linha', 'Texto'], ...rows]);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'PDF');

  const outputPath = path.join(__dirname, '..', 'converted', `${outputFilename}.xlsx`);
  XLSX.writeFile(workbook, outputPath);
  
  console.log(`✅ Arquivo convertido e salvo em: ${outputPath}`);
}, { connection });

worker.on('failed', (job, err) => {
  console.error(`[✖] Job ${job.id} falhou:`, err.message);
});
