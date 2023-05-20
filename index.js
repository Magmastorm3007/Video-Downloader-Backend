const express = require('express');
const multer = require('multer');
const { BullAdapter,SetQueues } = require('bull-board/bullAdapter');
const {JobModel}=require('./Model')
const Queue = require('bull');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://user:aloo@cluster0.ybbgwrx.mongodb.net/?retryWrites=true&w=majority/Jobs', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));

// Create a Bull queue
const videoQueue = new Queue('videoQueue');
// Create BullAdapter instance
const videoQueueAdapter = new BullAdapter(videoQueue);

// Register the BullAdapter with BullBoard
//SetQueues(videoQueueAdapter);



// Define route to add video link to the queue
app.post('/upload', upload.single('video'), async (req, res) => {
  const { videoLink } = req.body;

  // Create a new job in MongoDB Atlas
  const job = await JobModel.create({ status: 'processing' });

  // Add the job to the Bull queue
  videoQueue.add({ videoLink, jobId: job._id });

  res.json({ jobId: job._id });
});

// Define route to download processed video
app.get('/download/:jobId', async (req, res) => {
  const { jobId } = req.params;

  // Fetch the job from MongoDB Atlas
  const job = await JobModel.findById(jobId);

  if (!job || job.status !== 'completed') {
    return res.status(404).json({ message: 'Job not found or processing incomplete' });
  }

  const filePath = `./output_${jobId}.mp4`;
  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(404)
    }
  })
})

app.get('/', (req, res) => {
  res.send('Hello World!')
})

const port = 5000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);

});
