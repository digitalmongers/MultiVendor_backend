import jsonwebtoken from 'jsonwebtoken';
import env from '../config/env.js';

export const generateToken = (userId, extras = {}) => {
  return jsonwebtoken.sign({ id: userId, ...extras }, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRE,
  });
};

export const generateRefreshToken = (userId, extras = {}, expiresIn = env.JWT_REFRESH_EXPIRE) => {
  return jsonwebtoken.sign({ id: userId, ...extras }, env.JWT_REFRESH_SECRET, {
    expiresIn,
  });
};

export const verifyToken = (token) => {
  return jsonwebtoken.verify(token, env.JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jsonwebtoken.verify(token, env.JWT_REFRESH_SECRET);
};
