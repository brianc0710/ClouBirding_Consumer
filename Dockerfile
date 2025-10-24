# Use official Node.js image
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy dependency files and install packages
COPY package*.json ./
RUN npm install

# Copy project files
COPY . .

# Set environment variables (optional)
ENV NODE_ENV=production

# Start the consumer script
CMD ["npm", "start"]
