const mongoose = require('mongoose');

// Define the job schema
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
  
});


const JobModel = mongoose.model('Job', jobSchema);

module.exports = { JobModel };