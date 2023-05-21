const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

const JobModel = require('./Model').JobModel;
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const Queue = require('bull');

const app = express();
app.use(express.json());

const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB Atlas
mongoose
  .connect('mongodb+srv://user:aloo@cluster0.ybbgwrx.mongodb.net/Jobs?retryWrites=true&w=majority', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));

// Create a new Bull queue
const myQueue = new Queue('myqueue', {
  redis: {
    host: '127.0.0.1',
    port: 6379,
    password: null,
    db: 0,
  },
});

// Define a Bull worker to process the queue
myQueue.process(async (job) => {
  const { jobId } = job.data;
  const inputFilePath = `./uploads/video_${jobId}.mp4`;
  const outputFilePath = `./uploads/video_processed_${jobId}.mp4`;

  try {
    await processVideo(inputFilePath, outputFilePath, jobId);
    console.log('Job completed:', job.id);
  } catch (error) {
    console.error('Error processing job:', job.id, error);
    // Handle error accordingly
  }
});

// Function to process a video and update job status
async function processVideo(inputFilePath, outputFilePath, jobId) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputFilePath)
      // Apply desired filters and operations using ffmpeg methods
      .output(outputFilePath)
      .on('end', async () => {
        console.log('Video processing completed');
        // Update job status to 'completed' in the database
        try {
          await JobModel.findOneAndUpdate({ jobId }, { status: 'completed' });
          resolve();
        } catch (error) {
          reject(error);
        }
      })
      .on('error', (err) => {
        console.error('Error processing video:', err);
        reject(err);
      })
      .run();
  });
}

// Define route to add video link to the queue
app.post('/api/uploads', upload.single('video'), async (req, res) => {
  const { fileLink } = req.body;
  // Download the video from the given link and save it to the upload folder uploads/video_${job._id}.mp4;
  const response = await axios.get(fileLink, { responseType: 'stream' });
  const jobId = uuidv4(); // Generate a unique job ID
  const filePath = `uploads/video_${jobId}.mp4`; // Append the job ID to the file path
  const fileStream = fs.createWriteStream(filePath);
  response.data.pipe(fileStream);
  fileStream.on('finish', async () => {
    // Create a new job in MongoDB Atlas
    const job = new JobModel({
      jobId: jobId,
      status: 'processing',
    });
    job
      .save()
      .then((savedJob) => {
        console.log('Job saved:', savedJob);
        // Enqueue the job to the Bull queue
        myQueue.add({ jobId: savedJob.jobId });
      })
      .catch((error) => {
        console.error('Error saving job:', error);
      });

    res.json({ jobId: job.jobId });
  });
});

// Define route to download processed video
app.get('/api/download/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const filePath = `./uploads/video_processed_${jobId}.mp4`;

  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(404).json({ message: 'Error downloading file' });
    }
  });
});

const { BullAdapter } = require('bull-board/bullAdapter');



const port = 5000;
app.listen(port, () => {
  console.log('Express server running');
});