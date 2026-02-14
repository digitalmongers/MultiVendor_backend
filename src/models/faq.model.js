import mongoose from 'mongoose';

const faqSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: [true, 'Please provide a question'],
      trim: true,
    },
    answer: {
      type: String,
      required: [true, 'Please provide an answer'],
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// PERFORMANCE OPTIMIZATION: Database Indexes
// ========================================

// Index for question text search
faqSchema.index({ question: 'text', answer: 'text' });

const FAQ = mongoose.model('FAQ', faqSchema);

export default FAQ;
