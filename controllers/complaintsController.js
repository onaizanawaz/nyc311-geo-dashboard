const { query } = require('../config/db');

const TABLE_NAME = 'nyc_311_complaints';

function parseInteger(value, defaultValue, options = {}) {
  const { min = 0, max = 1000 } = options;

  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return { error: 'Value must be an integer.' };
  }

  if (parsed < min || parsed > max) {
    return { error: `Value must be between ${min} and ${max}.` };
  }

  return parsed;
}

async function getComplaintTypes(req, res, next) {
  try {
    const result = await query({
      text: `SELECT DISTINCT complaint_type
             FROM ${TABLE_NAME}
             WHERE complaint_type IS NOT NULL
             ORDER BY complaint_type ASC`,
    });

    const types = result.rows
      .map((row) => row.complaint_type)
      .filter(Boolean);

    res.json(types);
  } catch (error) {
    console.error('[DB] Failed to fetch complaint types:', error.message);
    next(error);
  }
}

async function getComplaintStats(req, res, next) {
  try {
    const result = await query({
      text: `SELECT complaint_type, COUNT(*) AS count
             FROM ${TABLE_NAME}
             WHERE complaint_type IS NOT NULL
             GROUP BY complaint_type
             ORDER BY count DESC, complaint_type ASC`,
    });

    const stats = result.rows.map((row) => ({
      complaint_type: row.complaint_type,
      count: Number(row.count),
    }));

    res.json(stats);
  } catch (error) {
    console.error('[DB] Failed to fetch complaint stats:', error.message);
    next(error);
  }
}

async function getComplaints(req, res, next) {
  try {
    const { type, limit, offset } = req.query;

    const normalizedType = typeof type === 'string' ? type.trim() : '';
    if (type !== undefined && normalizedType.length === 0) {
      return res.status(400).json({ error: 'type must be a non-empty string.' });
    }

    const parsedLimit = parseInteger(limit, 50, { min: 1, max: 1000 });
    if (parsedLimit && typeof parsedLimit === 'object' && parsedLimit.error) {
      return res.status(400).json({ error: parsedLimit.error });
    }

    const parsedOffset = parseInteger(offset, 0, { min: 0, max: 100000 });
    if (parsedOffset && typeof parsedOffset === 'object' && parsedOffset.error) {
      return res.status(400).json({ error: parsedOffset.error });
    }

    const values = [];
    const conditions = [];

    if (normalizedType) {
      conditions.push(`complaint_type = $${values.length + 1}`);
      values.push(normalizedType);
    }

    const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';
    const queryText = `SELECT * FROM ${TABLE_NAME}${whereClause} ORDER BY complaint_type ASC LIMIT $${values.length + 1} OFFSET $${values.length + 2}`;
    values.push(parsedLimit, parsedOffset);

    const result = await query({ text: queryText, values });

    const complaints = result.rows.map((row) => {
      const { geometry, ...rest } = row;
      return rest;
    });

    res.json({
      items: complaints,
      pagination: {
        limit: parsedLimit,
        offset: parsedOffset,
        count: complaints.length,
      },
    });
  } catch (error) {
    console.error('[DB] Failed to fetch complaints:', error.message);
    next(error);
  }
}

module.exports = {
  getComplaintTypes,
  getComplaintStats,
  getComplaints,
};
