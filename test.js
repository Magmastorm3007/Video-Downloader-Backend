const { Worker, Plugins, Scheduler, Queue } =require("node-resque")
const express = require('express');
const multer = require('multer');



const { promisify } = require('util');
const JobModel = require('./Model').JobModel;
const axios = require('axios');
const fs = require('fs');
const mongoose = require('mongoose');
const ffmpeg = require('fluent-ffmpeg');
mongoose.connect('mongodb+srv://user:aloo@cluster0.ybbgwrx.mongodb.net/Jobs?retryWrites=true&w=majority', { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('Error connecting to MongoDB Atlas:', err));

const app = express();
app.use(express.json())
const upload = multer({ dest: 'uploads/' });
async function boot() {

  const connectionDetails = {
    pkg: "ioredis",
    host: "127.0.0.1",
    password: null,
    port: 6379,
    database: 0,
   
  };



  let jobsToComplete = 0;
  
  const jobs = {
    process: {
      plugins: [Plugins.JobLock],
      pluginOptions: {
        JobLock: { reEnqueue: true },
      },
      perform: async (job) => {
        await new Promise((resolve) => {
            console.log('Processing job:', job.id);
            const { jobId } = job.data;
            const inputFilePath = `./uploads/video_${jobId}.mp4`;
            const outputFilePath = `./uploads/video_processed_${jobId}.mp4`;
        
            try {
               processVideo(inputFilePath, outputFilePath, jobId);
              console.log('Job completed:', job.id);
            } catch (error) {
              console.error('Error processing job:', job.id, error);
              // Handle error accordingly
            }
        });
        jobsToComplete--;
        tryShutdown();

     
        return "ok";
      },
    },
   
  };









  // just a helper for this demo
  async function tryShutdown() {
    if (jobsToComplete === 0) {
      await new Promise((resolve) => {
        setTimeout(resolve, 500);
      });
      await scheduler.end();
      await worker.end();
      process.exit();
    }
  }

  // /////////////////
  // START A WORKER //
  // /////////////////

  const worker = new Worker(
    { connection: connectionDetails, queues: ["math", "otherQueue"] },
    jobs
  );
  await worker.connect();
  worker.start();

  // ////////////////////
  // START A SCHEDULER //
  // ////////////////////

  const scheduler = new Scheduler({ connection: connectionDetails });
  await scheduler.connect();
  scheduler.start();

  // //////////////////////
  // REGISTER FOR EVENTS //
  // //////////////////////

  worker.on("start", () => {
    console.log("worker started");
  });
  worker.on("end", () => {
    console.log("worker ended");
  });
  worker.on("cleaning_worker", (worker, pid) => {
    console.log(`cleaning old worker ${worker}`);
  });
  worker.on("poll", (queue) => {
    console.log(`worker polling ${queue}`);
  });
  worker.on("ping", (time) => {
    console.log(`worker check in @ ${time}`);
  });
  worker.on("job", (queue, job) => {
    console.log(`working job ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("reEnqueue", (queue, job, plugin) => {
    console.log(`reEnqueue job (${plugin}) ${queue} ${JSON.stringify(job)}`);
  });
  worker.on("success", (queue, job, result, duration) => {
    console.log(
      `job success ${queue} ${JSON.stringify(job)} >> ${result} (${duration}ms)`
    );
  });
  worker.on("failure", (queue, job, failure, duration) => {
    console.log(
      `job failure ${queue} ${JSON.stringify(
        job
      )} >> ${failure} (${duration}ms)`
    );
  });
  worker.on("error", (error, queue, job) => {
    console.log(`error ${queue} ${JSON.stringify(job)}  >> ${error}`);
  });
  worker.on("pause", () => {
    console.log("worker paused");
  });

  scheduler.on("start", () => {
    console.log("scheduler started");
  });
  scheduler.on("end", () => {
    console.log("scheduler ended");
  });
  scheduler.on("poll", () => {
    console.log("scheduler polling");
  });
  scheduler.on("leader", () => {
    console.log("scheduler became leader");
  });
  scheduler.on("error", (error) => {
    console.log(`scheduler error >> ${error}`);
  });
  scheduler.on("cleanStuckWorker", (workerName, errorPayload, delta) => {
    console.log(
      `failing ${workerName} (stuck for ${delta}s) and failing job ${errorPayload}`
    );
  });
  scheduler.on("workingTimestamp", (timestamp) => {
    console.log(`scheduler working timestamp ${timestamp}`);
  });
  scheduler.on("transferredJob", (timestamp, job) => {
    console.log(`scheduler enquing job ${timestamp} >> ${JSON.stringify(job)}`);
  });



  const queue = new Queue({ connection: connectionDetails }, jobs);
  queue.on("error", function (error) {
    console.log(error);
  });
  await queue.connect();
}


boot();




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



  queue.enqueue("job",'myworker', { jobId: jobId });
  jobsToComplete++;
  // Usage within your job processing logic
  
    res.json({ jobId: job.id });
  });
});

  


// Define route to download processed video
app.get('/api/download/', async (req, res) => {
  const { jobId } = req.params;



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


