const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err.message.startsWith('Invalid file type')) {
    return res.status(400).json({ message: err.message });
  }

  res.status(500).json({ message: 'Something went wrong!' });
};

module.exports = errorHandler;
