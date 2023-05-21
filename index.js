const express = require('express');
const multer = require('multer');

const JobModel = require('./Model').JobModel;
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
const NodeResque = require('node-resque');

const Redis = require('ioredis');

// Create a new Redis connection instance

const connection={
  pkg: "ioredis",
  host: "127.0.0.1",
  password: null,
  port: 6379,
  database: 0,
}

const myQueue = new NodeResque.Queue({ connection });

// Create a new worker
const myWorker = new NodeResque.Worker(
  { connection, queues: ['myqueue'] },
  async (job, done) => {
    

    console.log('Processing job:', job.id);
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
  },
  
);

// Start the worker

console.log('Worker connected:', myWorker.connected);


const app = express();
app.use(express.json())



const upload = multer({ dest: 'uploads/' });

// Connect to MongoDB Atlas
mongoose.connect('mongodb+srv://user:aloo@cluster0.ybbgwrx.mongodb.net/Jobs?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));





  
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

  console.log('reached')
  const { fileLink } = req.body;
  // Download the video from the given link and save it to the upload folder `uploads/video_${job._id}.mp4`;
  const response = await axios.get(fileLink, { responseType: 'stream' });
  const jobId = new mongoose.Types.ObjectId().toString(); // Generate a unique job ID
  const filePath = `uploads/video_${jobId}.mp4`; // Append the job ID to the file path
  const fileStream = fs.createWriteStream(filePath);
  response.data.pipe(fileStream);
  fileStream.on('finish', async () => {
    // Create a new job in MongoDB Atlas
   const job= new JobModel({
      jobId: jobId,
      status: 'processing',
    });
    job.save()
  .then(savedJob => {
    console.log('Job saved:', savedJob);
  })
  .catch(error => {
    console.error('Error saving job:', error);
  });

  await myQueue.enqueue('myqueue', 'Job', [job.id, { jobId: job.id }]);
   // await myQueue.add(job.id, { jobId: job.id });
  // Usage within your job processing logic
  
    res.json({ jobId: job.id });
  });
});

async function runJobs() {
  const jobs = await myQueue.queued('myqueue');

  if (jobs.length > 0) {
    console.log('Running jobs:');
    for (const job of jobs) {
      console.log('Job ID');
      // Process the job using job.args[0] and job.args[1] (e.g., jobId and data)
    }
  } else {
    console.log('No jobs to run.');
  }
}

runJobs()


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
