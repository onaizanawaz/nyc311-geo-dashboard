const express = require('express');
const {
  getComplaintTypes,
  getComplaintStats,
  getComplaints,
} = require('../controllers/complaintsController');

const router = express.Router();

router.get('/types', async (req, res, next) => {
  try {
    await getComplaintTypes(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    await getComplaintStats(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    await getComplaints(req, res, next);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
