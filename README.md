# Chit

Chit is a (hopefully somewhat) secure chat platform.
Chit is also a web application running on said platform.
A de facto standard implementation, if you will…

Chit is still in deep alpha stage. Lots of stuff is happening.
APIs are changing, new features are pouring in every minute.
At least I wish they were…

If you think this could become something cool, please help out!
We need everything: Coders, designers, writers, testers, fans…

For some more information, check the [Design Specs](design-specs.md).

# Installation

Chit is built on [Node.js](http://nodejs.org/) and [Redis](http://redis.io/).
So you need to have a node.js installed and a redis server running.

To install Chit, do the following:

    git clone https://github.com/tikki/Chit.git chit
    cd chit
    npm install

Now you need to create a config file.
Copy the example config and edit it.

    cp config.example.json config.json
    vim config.json

That's all! Now run it and connect using your web browser.

`node app`
