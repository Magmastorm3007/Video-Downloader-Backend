const express = require('express');
const multer = require('multer');

const {JobModel}=require('./Model')
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const { Queue,Worker } =require ('bullmq');

const app = express();
app.use(express.json())

const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://user:aloo@cluster0.ybbgwrx.mongodb.net/?retryWrites=true&w=majority/Jobs', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));

// Define route to add video link to the queue
app.post('/api/uploads', upload.single('video'), async (req, res) => {

  console.log('reached')
  const { fileLink } = req.body;
  // Download the video from the given link and save it to the upload folder `uploads/video_${job._id}.mp4`;
  const response = await axios.get(fileLink, { responseType: 'stream' });
  const filePath = `uploads/video_3.mp4`;
  const fileStream = fs.createWriteStream(filePath);
  response.data.pipe(fileStream);
fileStream.on('finish', () => {
 
  });

  // Create a new job in MongoDB Atlas
 // const job = await JobModel.create({ status: 'processing' });
  

  //res.json({ jobId: job._id });
  res.json('nice job')
});

// Define route to download processed video
app.get('/api/download/', async (req, res) => {
  const { jobId } = req.params;

  // Fetch the job from MongoDB Atlas
//  const job = await JobModel.findById(jobId);

 // if (!job || job.status !== 'completed') {
  //  return res.status(404).json({ message: 'Job not found or processing incomplete' });
  //}

  //const filePath = `./output_${jobId}.mp4`;

const filePath = `./uploads/video_3.mp4`;
  res.download(filePath, (err) => {
    if (err) {
      console.error('Error downloading file:', err);
      res.status(404)
    }
    
  })
})

app.get('/', (req, res) => {
  res.send('Hello World!');
})

const port = 5000;
app.listen(port, () => {
  console.log(`Server started on port ${port}`);

});
