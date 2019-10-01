FROM node:12.4.0-alpine

# Create the directory!
RUN mkdir -p /home/root/app
WORKDIR /home/root/app

# Our precious bot
COPY ./app /home/root/app

# Start me!
CMD ["npm", "start"]