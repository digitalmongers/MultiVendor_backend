import { jest } from '@jest/globals';
import mongoose from 'mongoose';
import { faker } from '@faker-js/faker';
import bcrypt from 'bcryptjs';
import argon2 from 'argon2';

/**
 * Database Seeder
 * Populates test database with realistic data
 */
class DatabaseSeeder {
  constructor() {
    this.admins = [];
    this.customers = [];
    this.vendors = [];
    this.products = [];
    this.categories = [];
    this.orders = [];
    this.carts = [];
  }

  async seedAll() {
    console.log('🌱 Starting database seeding...');
    
    await this.seedCategories();
    await this.seedAdmins();
    await this.seedCustomers();
    await this.seedVendors();
    await this.seedProducts();
    await this.seedOrders();
    await this.seedCarts();
    
    console.log('✅ Database seeding completed!');
  }

  async seedCategories(count = 10) {
    const categories = [];
    
    for (let i = 0; i < count; i++) {
      const category = {
        name: faker.commerce.department(),
        description: faker.lorem.paragraph(),
        image: {
          url: faker.image.url(),
          publicId: faker.string.alphanumeric(20)
        },
        isActive: true,
        sortOrder: i
      };
      
      const created = await mongoose.model('ProductCategory').create(category);
      categories.push(created);
    }
    
    this.categories = categories;
    console.log(`📁 Created ${categories.length} categories`);
    return categories;
  }

  async seedAdmins(count = 5) {
    const admins = [];
    
    for (let i = 0; i < count; i++) {
      const adminData = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: await argon2.hash('AdminPassword123!'),
        phoneNumber: faker.phone.number('91##########').toString(),
        role: faker.helpers.arrayElement(['admin', 'superadmin']),
        isActive: true,
        tokenVersion: 0,
        permissions: [
          'USER_MANAGEMENT',
          'PRODUCT_MANAGEMENT',
          'ORDER_MANAGEMENT',
          'SYSTEM_SETTINGS'
        ]
      };
      
      const created = await mongoose.model('Admin').create(adminData);
      admins.push(created);
    }
    
    this.admins = admins;
    console.log(`👑 Created ${admins.length} admins`);
    return admins;
  }

  async seedCustomers(count = 50) {
    const customers = [];
    
    for (let i = 0; i < count; i++) {
      const customerData = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: await argon2.hash('CustomerPassword123!'),
        phoneNumber: faker.phone.number('91##########').toString(),
        isVerified: faker.datatype.boolean({ probability: 0.8 }), // 80% verified
        isActive: faker.datatype.boolean({ probability: 0.95 }), // 95% active
        tokenVersion: 0,
        lastLogin: faker.date.recent(),
        addresses: this.generateAddresses()
      };
      
      const created = await mongoose.model('Customer').create(customerData);
      customers.push(created);
    }
    
    this.customers = customers;
    console.log(`👤 Created ${customers.length} customers`);
    return customers;
  }

  async seedVendors(count = 20) {
    const vendors = [];
    
    for (let i = 0; i < count; i++) {
      const vendorData = {
        name: faker.person.fullName(),
        email: faker.internet.email(),
        password: await argon2.hash('VendorPassword123!'),
        phoneNumber: faker.phone.number('91##########').toString(),
        businessName: faker.company.name(),
        businessType: faker.helpers.arrayElement(['retail', 'wholesale', 'manufacturer']),
        businessLicense: faker.string.alphanumeric(15),
        taxId: faker.string.alphanumeric(10),
        isActive: faker.datatype.boolean({ probability: 0.9 }), // 90% active
        isVerified: faker.datatype.boolean({ probability: 0.7 }), // 70% verified
        tokenVersion: 0,
        businessAddress: this.generateAddresses()[0],
        bankDetails: {
          accountName: faker.company.name(),
          accountNumber: faker.finance.accountNumber(),
          bankName: faker.finance.bankName(),
          ifscCode: faker.finance.bic()
        }
      };
      
      const created = await mongoose.model('Vendor').create(vendorData);
      vendors.push(created);
    }
    
    this.vendors = vendors;
    console.log(`🏪 Created ${vendors.length} vendors`);
    return vendors;
  }

  async seedProducts(count = 100) {
    const products = [];
    
    for (let i = 0; i < count; i++) {
      const vendor = faker.helpers.arrayElement(this.vendors);
      const category = faker.helpers.arrayElement(this.categories);
      
      const productData = {
        name: faker.commerce.productName(),
        description: faker.commerce.productDescription(),
        price: parseFloat(faker.commerce.price({ min: 10, max: 1000 })),
        discount: faker.datatype.number({ min: 0, max: 50 }),
        discountType: faker.helpers.arrayElement(['flat', 'percent']),
        category: category._id,
        subcategory: this.createSubcategory(category._id),
        vendor: vendor._id,
        sku: faker.string.alphanumeric(10),
        stock: faker.datatype.number({ min: 1, max: 100 }),
        minStock: faker.datatype.number({ min: 1, max: 10 }),
        maxStock: faker.datatype.number({ min: 50, max: 500 }),
        weight: parseFloat(faker.datatype.float({ min: 0.1, max: 10 }).toFixed(2)),
        dimensions: {
          length: parseFloat(faker.datatype.float({ min: 1, max: 100 }).toFixed(2)),
          width: parseFloat(faker.datatype.float({ min: 1, max: 100 }).toFixed(2)),
          height: parseFloat(faker.datatype.float({ min: 1, max: 100 }).toFixed(2))
        },
        images: this.generateProductImages(),
        tags: this.generateProductTags(),
        specifications: this.generateProductSpecifications(),
        isActive: faker.datatype.boolean({ probability: 0.9 }), // 90% active
        isFeatured: faker.datatype.boolean({ probability: 0.2 }), // 20% featured
        seoTitle: faker.lorem.sentence(),
        seoDescription: faker.lorem.paragraph(),
        seoKeywords: faker.lorem.words(5).join(', ')
      };
      
      const created = await mongoose.model('Product').create(productData);
      products.push(created);
    }
    
    this.products = products;
    console.log(`📦 Created ${products.length} products`);
    return products;
  }

  async seedOrders(count = 200) {
    const orders = [];
    
    for (let i = 0; i < count; i++) {
      const customer = faker.helpers.arrayElement(this.customers);
      const vendor = faker.helpers.arrayElement(this.vendors);
      const orderItems = this.generateOrderItems();
      
      const orderData = {
        customer: customer._id,
        vendor: vendor._id,
        items: orderItems,
        subtotal: orderItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        tax: faker.datatype.number({ min: 0, max: 100 }),
        shipping: faker.datatype.number({ min: 0, max: 50 }),
        totalAmount: 0, // Will be calculated
        status: faker.helpers.arrayElement(['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled']),
        paymentStatus: faker.helpers.arrayElement(['pending', 'paid', 'failed', 'refunded']),
        paymentMethod: faker.helpers.arrayElement(['cod', 'card', 'upi', 'wallet']),
        shippingAddress: this.generateAddresses()[0],
        billingAddress: this.generateAddresses()[0],
        orderDate: faker.date.recent(),
        estimatedDelivery: faker.date.future(),
        trackingNumber: faker.string.alphanumeric(15),
        notes: faker.lorem.sentences(2)
      };
      
      orderData.totalAmount = orderData.subtotal + orderData.tax + orderData.shipping;
      
      const created = await mongoose.model('Order').create(orderData);
      orders.push(created);
    }
    
    this.orders = orders;
    console.log(`📋 Created ${orders.length} orders`);
    return orders;
  }

  async seedCarts(count = 100) {
    const carts = [];
    
    for (let i = 0; i < count; i++) {
      const customer = faker.helpers.arrayElement(this.customers);
      const cartItems = this.generateCartItems();
      
      const cartData = {
        customer: customer._id,
        items: cartItems,
        subtotal: cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        lastActivity: faker.date.recent(),
        isActive: true
      };
      
      const created = await mongoose.model('Cart').create(cartData);
      carts.push(created);
    }
    
    this.carts = carts;
    console.log(`🛒 Created ${carts.length} carts`);
    return carts;
  }

  // Helper methods
  generateAddresses() {
    return [
      {
        type: 'home',
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: faker.location.country(),
        isDefault: true
      },
      {
        type: 'work',
        street: faker.location.streetAddress(),
        city: faker.location.city(),
        state: faker.location.state(),
        postalCode: faker.location.zipCode(),
        country: faker.location.country(),
        isDefault: false
      }
    ];
  }

  createSubcategory(categoryId) {
    return {
      name: faker.commerce.department(),
      description: faker.lorem.paragraph(),
      category: categoryId,
      isActive: true
    };
  }

  generateProductImages() {
    const imageCount = faker.datatype.number({ min: 1, max: 5 });
    const images = [];
    
    for (let i = 0; i < imageCount; i++) {
      images.push({
        url: faker.image.url(),
        publicId: faker.string.alphanumeric(20),
        alt: faker.lorem.sentence(),
        isPrimary: i === 0
      });
    }
    
    return images;
  }

  generateProductTags() {
    const tagCount = faker.datatype.number({ min: 2, max: 8 });
    const tags = [];
    
    for (let i = 0; i < tagCount; i++) {
      tags.push(faker.commerce.productAdjective());
    }
    
    return tags;
  }

  generateProductSpecifications() {
    return {
      brand: faker.company.name(),
      model: faker.vehicle.model(),
      color: faker.color.human(),
      size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL', 'XXL']),
      material: faker.helpers.arrayElement(['Cotton', 'Polyester', 'Wool', 'Silk']),
      weight: `${faker.datatype.number({ min: 100, max: 2000 })}g`,
      dimensions: `${faker.datatype.number({ min: 10, max: 100 })}x${faker.datatype.number({ min: 10, max: 100 })}x${faker.datatype.number({ min: 1, max: 50 })}cm`,
      warranty: `${faker.datatype.number({ min: 1, max: 24 })} months`,
      origin: faker.location.country()
    };
  }

  generateOrderItems() {
    const itemCount = faker.datatype.number({ min: 1, max: 5 });
    const items = [];
    
    for (let i = 0; i < itemCount; i++) {
      items.push({
        product: faker.database.mongodbObjectId(),
        quantity: faker.datatype.number({ min: 1, max: 10 }),
        price: parseFloat(faker.commerce.price({ min: 10, max: 500 })),
        discount: faker.datatype.number({ min: 0, max: 30 }),
        variation: {
          size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']),
          color: faker.color.human()
        }
      });
    }
    
    return items;
  }

  generateCartItems() {
    const itemCount = faker.datatype.number({ min: 1, max: 8 });
    const items = [];
    
    for (let i = 0; i < itemCount; i++) {
      items.push({
        product: faker.database.mongodbObjectId(),
        quantity: faker.datatype.number({ min: 1, max: 5 }),
        price: parseFloat(faker.commerce.price({ min: 10, max: 300 })),
        variation: {
          size: faker.helpers.arrayElement(['S', 'M', 'L', 'XL']),
          color: faker.color.human()
        },
        addedAt: faker.date.recent()
      });
    }
    
    return items;
  }

  async clearAll() {
    console.log('🧹 Clearing all seeded data...');
    
    const models = [
      'Cart',
      'Order',
      'Product',
      'Vendor',
      'Customer',
      'Admin',
      'ProductCategory'
    ];
    
    for (const modelName of models) {
      await mongoose.model(modelName).deleteMany({});
    }
    
    console.log('✅ All seeded data cleared');
  }

  // Get specific data for tests
  getRandomAdmin() {
    return faker.helpers.arrayElement(this.admins);
  }

  getRandomCustomer() {
    return faker.helpers.arrayElement(this.customers);
  }

  getRandomVendor() {
    return faker.helpers.arrayElement(this.vendors);
  }

  getRandomProduct() {
    return faker.helpers.arrayElement(this.products);
  }

  getProductsByVendor(vendorId) {
    return this.products.filter(p => p.vendor.toString() === vendorId.toString());
  }

  getOrdersByCustomer(customerId) {
    return this.orders.filter(o => o.customer.toString() === customerId.toString());
  }
}

export default DatabaseSeeder;
