const mongoose = require('mongoose');

// Define the Job schema
const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
  },
  status: {
    type: String,
    required: true,
  },
  error: String,
}, { timestamps: true });


const JobModel = mongoose.model('Jobs', jobSchema);

module.exports = JobModel;