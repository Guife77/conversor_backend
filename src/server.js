require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const convertQueue = require('./jobs/queue');
const { Job } = require('bullmq');
const app = express();
const PORT = process.env.PORT || 3333;

// Middlewares
app.use(express.json());
app.use('/converted', express.static(path.join(__dirname, 'converted')));

// Configuração do multer para upload
const storage = multer.diskStorage({
  destination: path.join(__dirname, 'uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext);
    const uniqueSuffix = Date.now();
    cb(null, `${base}-${uniqueSuffix}${ext}`);
  }
});
const upload = multer({ storage });

// Rota para upload e conversão de PDF
app.post('/upload', upload.single('file'), async (req, res) => {
  const file = req.file;
  if (!file) return res.status(400).json({ error: 'Arquivo não enviado' });

  const filename = path.parse(file.originalname).name;
  const outputFilename = `${filename}-${Date.now()}`;

  const job = await convertQueue.add('default', {
    filePath: file.path,
    outputFilename
  });

  return res.status(202).json({
    message: 'Arquivo enviado com sucesso. Conversão em andamento.',
    jobId: job.id,
    output: `/converted/${outputFilename}.xlsx`
  });
});

// Rota para consultar status de um job
app.get('/status/:id', async (req, res) => {
  const jobId = req.params.id;

  try {
    const job = await Job.fromId(convertQueue, jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    const state = await job.getState();
    const progress = job._progress;
    const reason = job.failedReason;

    return res.status(200).json({
      status: state,
      progress,
      reason,
      resultPath: `/converted/${job.data.outputFilename}.xlsx`
    });
  } catch (err) {
    console.error('Erro ao buscar job:', err);
    return res.status(500).json({ error: 'Erro ao buscar status do job' });
  }
});

app.delete('/cancel/:id', async (req, res) => {
  const jobId = req.params.id;

  try {
    const job = await Job.fromId(convertQueue, jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job não encontrado' });
    }

    const state = await job.getState();

    if (state === 'completed' || state === 'failed') {
      return res.status(400).json({ error: 'Não é possível cancelar jobs já finalizados' });
    }

    await job.remove();

    return res.status(200).json({ message: 'Job cancelado com sucesso' });
  } catch (err) {
    console.error('Erro ao cancelar job:', err);
    return res.status(500).json({ error: 'Erro interno ao cancelar job' });
  }
});


// Start
app.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});
