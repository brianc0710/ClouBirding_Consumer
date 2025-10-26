# Use official Node.js image
FROM node:18

# Install system dependencies for sharp
RUN apt-get update && apt-get install -y libvips libvips-dev && rm -rf /var/lib/apt/lists/*

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
