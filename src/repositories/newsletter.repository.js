import Newsletter from '../models/newsletter.model.js';

class NewsletterRepository {
  async subscribe(email) {
    return await Newsletter.findOneAndUpdate(
      { email },
      { status: 'subscribed' },
      { upsert: true, new: true }
    );
  }

  async unsubscribe(email) {
    return await Newsletter.findOneAndUpdate(
      { email },
      { status: 'unsubscribed' },
      { new: true }
    );
  }

  async findByEmail(email) {
    return await Newsletter.findOne({ email }).lean();
  }

  async findAll(options = {}) {
    const { 
      search, 
      startDate, 
      endDate, 
      sortBy = 'newestFirst', 
      limit = 10, 
      skip = 0 
    } = options;

    const query = {};

    // 1. Email Search (Regex)
    if (search) {
      query.email = { $regex: search, $options: 'i' };
    }

    // 2. Date Range Filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // 3. Sorting
    let sort = { createdAt: -1 }; // Default: Newest First
    switch (sortBy) {
      case 'oldestFirst':
        sort = { createdAt: 1 };
        break;
      case 'emailAZ':
        sort = { email: 1 };
        break;
      case 'emailZA':
        sort = { email: -1 };
        break;
      case 'newestFirst':
      default:
        sort = { createdAt: -1 };
    }

    const subscribers = await Newsletter.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Newsletter.countDocuments(query);

    return { subscribers, total };
  }
}

const newsletterRepository = new NewsletterRepository();
export { newsletterRepository as NewsletterRepository };
