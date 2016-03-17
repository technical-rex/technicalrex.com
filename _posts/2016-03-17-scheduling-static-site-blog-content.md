---
layout: post
title: "Schedule Blog Content for a Static Site"
author: erik
category: programming
tags: []
permalink: /scheduling-static-site-content/
excerpt: >
  <p>Static site generators are very appealing to designers and coders who want
  to blog. They're free, fast, secure, rich with plugins and themes, and the
  lack of a database and little to no server-side processing sheds a lot of the
  hassle associated with blogging. There are features common to dynamic sites
  (like WordPress) that you won't get out of the box with a static site
  generator.</p>Like publishing content on a schedule.
---

Static site generators can be very appealing to bloggers. They're free, fast, secure, rich with plugins and themes, and the lack of a database and little to no server-side processing sheds a lot of the hassle associated with blogging. There are features common to dynamic sites (like WordPress) that you don't get out of the box with a static site generator, though. One such feature is publishing content on a schedule.

## Why Publish on a Schedule?

The ability to schedule blog posts enables writing in batches. For my business, [Giving Jar][1], I write about and promote a different charity every other week. If I can spend one day interviewing and writing about two or three charities, it frees me from that task for four to six weeks!

Publishing articles at a specific time also make it easier to automate newsletters, social media posts, and other promotional material for the blog. Making your schedule well-known also encourages visitors to return to your site to look for new content.

## Stay Near Your Comfort Zone

Once you find a solution for scheduling your static content, you probably won't have to mess with it again. For that reason, I'm going to recommend doing something that I normally discourage: stay near your comfort zone. This isn't the time to spend a lot of time learning a ton of new things if you have more important tasks to work on.

My comfort zone included [Jekyll][2] for the static site generator, [Surge.sh][3] for free static site hosting, [GitHub][4] for version control, [Grunt][5] for building and deploying, and a Linux-based VM on [Digital Ocean][6] for scheduling code.

If you know Middleman, Gulp, or Windows, use them! Take the ideas from this article, adapt them, and save yourself some time (and probably a headache!). Perhaps even write about your alternative experience?

## Assumptions

Let's assume you already have a blog created with Jekyll, you maintain your changes in GitHub, and you manually build the site, then deploy your changes at 9 AM every Wednesday to Surge.sh. Let's also assume you are hosting your site at `my-site.com` and your GitHub repository is located at `https://github.com/my-user/my-site.com`.

The general steps to automating this process are to consolidate the build and deployment process to a single script, and then run that script somewhere that is "always on" at the desired time.

Another quick note about command syntax: commands should be typed exactly as they appear after the dollar sign ($). Any text before the $ is just a hint about which user should run the command. Any lines starting with a hashtag (#) are simply comments about what the subsequent commands do and should not be typed out.

## Step 1: Consolidate Your Deployment

At the end of this step, you should have a single command that you can run to checkout, build, and deploy your site.

Right now, the manual process looks like this:

```sh
$ cd ~/my-site.com
$ git fetch --all
$ git reset --hard origin/master
$ jekyll build
$ surge _site
```

If we use Grunt to perform these steps as a single command, we first must install [NPM][7] (I recommend using [NVM][8] to install NPM), then creating a `package.json` file to save development dependencies (such as Grunt), installing those dependencies, and finally, writing a `Gruntfile.js` file that Grunt will use to do our checkout, build, and deployment.

If you're using Surge, you probably have NPM installed. As a refresher, installing NVM and NPM in Bash will look like this:

```sh
# Install NVM
$ touch ~/.bash_profile
$ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
$ . ~/.bash_profile

# Install NPM 4.3.1
$ nvm install 4.3.1
$ nvm use 4.3.1
```

Next, create a `package.json` file at the base of your static site and add the dependencies we'll need:

```sh
# Change to your project directory
$ cd ~/my-site.com

# Create package.json
$ npm init

# Install grunt
$ npm install -g grunt

# Install dependencies
$ npm install grunt --save-dev
$ npm install grunt-git --save-dev
$ npm install grunt-jekyll --save-dev
$ npm install grunt-surge --save-dev
```

You'll have a `package.json` that looks something like this:

```json
{
  "name": "my-site.com",
  "version": "1.0.0",
  "homepage": "http://my-site.com",
  "license": "MIT",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/my-user/my-site.com.git"
  },
  "devDependencies": {
    "grunt": "~0.4.5",
    "grunt-git": "^0.3.7",
    "grunt-jekyll": "^0.4.3",
    "grunt-surge": "^0.7.0"
  }
}
```

The last step is to create a `Gruntfile.js` in the same directory as your `package.json` and add all of the checkout, build, and deployment steps. Start with this:

```js
module.exports = function(grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    
    gitfetch: {
      latest: {
        options: {
          all: true
        }
      }
    },
    
    gitreset: {
      latest: {
        options: {
          mode: 'hard',
          commit: 'origin/master'
        }
      }
    },
  
    jekyll: {
      dist: {
        options: {
          serve: false,
          drafts: false,
          future: false
        }
      },
      test: {
        options: {
          serve: true,
          drafts: true,
          future: true
        }
      }
    },

    surge: {
      publish: {
        options: {
          project: '_site/'
        }
      }
    }
  });
  
  grunt.loadNpmTasks('grunt-git');
  grunt.loadNpmTasks('grunt-jekyll');
  grunt.loadNpmTasks('grunt-surge');
  
  grunt.registerTask('default', ['jekyll:dist']);
  grunt.registerTask('publish', ['gitfetch:latest', 'gitreset:latest', 'jekyll:dist', 'surge:publish']);
  grunt.registerTask('test', ['jekyll:test']);
};
```

At this point the manual process has now been consolidated down to a single `grunt` command that will checkout, build, and deploy your site:

```sh
$ grunt prod
```

This `Gruntfile.js` also allows you to run `grunt` to build your site without deploying it or `grunt test` to preview articles written for dates in the future or draft content.

**GOTCHA #1:** *Running `grunt prod` works on your computer, but it won't simply work like this when running from cron. That's because cron runs scheduled commands in isolated environments and certain settings that typically come from your Bash profile and NVM won't be accessible to cron commands. To get around this, create a shell script named `deploy.sh` at the root of your static site that will setup the environment before invoking Grunt.*

Here's what your `deploy.sh` might look like:

```bash
#!/bin/bash

exit_usage()
{
  echo "usage: $0 gruntfile_dir"
  exit 1
}

if [ "$#" -ne 1 ]; then
  exit_usage
fi

. ~/.bash_profile

. ~/.nvm/nvm.sh
nvm use default

cd $1
grunt prod
```

Add `deploy.sh` to a list of files excluded from your static site when it is built. In Jekyll, add an "exclude" list to the end of your `_config.yml`:

```yaml
# Exclude files from generated site
exclude:
  - Gemfile
  - Gemfile.lock
  - LICENSE
  - README.md
  - package.json
  - Gruntfile.js
  - node_modules
  - deploy.sh
```

Also, make sure you mark `deploy.sh` as executable.

```sh
# Set execute permission on deploy.sh
$ chmod 755 deploy.sh
```

Don't forget to add, commit, and push your changes to GitHub!

## Step 2: Setup a Virtual Machine

In order to deploy content on a schedule, we need a server that is running at the times we want to deploy. If you have a physical server that fits this criterion, by all means use it! I did not have a server to spare so I chose a virtual machine schedule deployments.

### Overview

This is a fairly large step and there are a few gotchas, so let me speak generally about what we're doing before diving into the details. We are creating a virtual environment where we can install all of the tools needed to checkout, build, and deploy our site at any time that we want. Ultimately we need to install Git, Ruby, Jekyll, NPM, Grunt, and Surge. Then we'll clone our site and use cron to run our `grunt publish` command on a schedule.

### Detailed Instructions

If you're following these steps to the letter, then the next step is to create a [Digital Ocean][6] account. Then create a droplet using the $5 per month pricing tier (yes, this solution costs money), choose the "Ubuntu 15.10 x64" image, and pick a data center nearest to where your readers are located.

**GOTCHA #2:** *If you use Digital Ocean for your VM, pay close attention to the IP address assigned to your VM. If it starts with "192.241." then delete it and create a new one. Surge.sh is also hosted on Digital Ocean and Surge's software prevents uploads from IP addresses on the same subnet as their own.*

Follow these instructions to [Use SSH Keys with Digital Ocean Droplets][9]. Then SSH to your Droplet as the root user to run the rest of the commands in this article.

You should run the first set of commands as root to do things like install git, curl, libssl, and ntpdate.

```sh
# Install git, curl, libssl, ntpdate, etc.
root@vm $ apt-get update
root@vm $ apt-get install git curl build-essential libssl-dev ntpdate
```

I also recommend creating a dedicated user for performing your deployments, so let's take care of that.

```sh
# Create a user named "myuser" and set its password
root@vm $ useradd -m myuser
root@vm $ passwd myuser

# Add user to sudoers file
root@vm $ echo "myuser ALL=(ALL:ALL) ALL" >> /etc/sudoers
```

Since we're going to be scheduling time-sensitive content, let's also adjust the time zone and run `ntpdate` occasionally so the time on the VM doesn't drift over a long period of time.

```sh
# Choose a time zone
root@vm $ dpkg-reconfigure tzdata

# Run ntpdate daily
root@vm $ printf '#!/bin/sh\nntpdate ntp.ubuntu.com\n' > /etc/cron.daily/ntpdate
```

All of the remaining commands should run as the user you created. If you are prompted for a password at any point, use the password you specified for "myuser".

```sh
# Switch to the user you created
root@vm $ su - myuser
```

Now let's install RVM, Ruby, and Bundler.

```sh
# Install the public key needed to fetch RVM
myuser@vm $ gpg --keyserver hkp://keys.gnupg.net --recv-keys 409B6B1796C275462A1703113804BB82D39DC0E3

# Download and install RVM
myuser@vm $ curl -L https://get.rvm.io | bash -s stable
myuser@vm $ source ~/.rvm/scripts/rvm
myuser@vm $ rvm requirements

# Install and configure Ruby
myuser@vm $ rvm install ruby
myuser@vm $ rvm use ruby --default
myuser@vm $ rvm rubygems current

# Install Bundler
myuser@vm $ gem install bundler
```

Next up: NVM and Node.

```sh
# Download and install NVM
myuser@vm $ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.31.0/install.sh | bash
myuser@vm $ . ~/.nvm/nvm.sh

# Install Node 4.3.1, or whichever version you'd like
myuser@vm $ nvm install 4.3.1
myuser@vm $ nvm use 4.3.1
```

That's it for software installation on your droplet!

## Step 3: Clone Your Site

Use Git to clone your static site and install its dependencies:

```sh
# Clone your static site from GitHub
myuser@vm $ git clone https://github.com/my-user/my-site.com.git
myuser@vm $ cd my-site.com

# Install Grunt and Surge
myuser@vm $ npm install -g grunt-cli
myuser@vm $ npm install -g surge

# Install project dependencies
myuser@vm $ bundle install
myuser@vm $ npm install
```

While we're here, let's log into Surge. Make sure you know your username and password.

```sh
# Login to Surge
myuser@vm $ surge login
```

This would be a good time to test deployments from the VM. This should do the trick:

```sh
# Manually deploy your site
myuser@vm $ /home/myuser/my-site.com/deploy.sh /home/myuser/my-site.com
```

Once everything deploys smoothly, we can schedule that script!

## Step 4: Schedule Deployments

Use cron to run `deploy.sh` on a schedule. First, edit your user's crontab:

```sh
# Edit your crontab
myuser@vm $ crontab -e
```

Add the following two lines to the crontab. The first line is simply a comment to help remember the schedule. In the following example, the script will run every Wednesday at 12:30 AM in the time zone that you configured for the VM. Here's a good [intro to scheduling with cron][10].

```
# Fetch blog content and deploy every Wednesday at 12:30 AM
30 0 * * 3 /home/myuser/my-site.com/deploy.sh prod /home/myuser/my-site.com/ > /home/myuser/log/blog.log 2>&1
```

The command also writes all output to a log file. That way, if an error occurs, you can look at the output to determine what went wrong. If you run your deployments frequently, you may also want to put a timestamp on your log files.

**THAT'S IT!** The deployments will start running on your schedule, freeing you from doing it by hand!

## Alternatives

Before writing my own solution, I tried to find something that already existed. There were a couple, but neither quite fit my needs. I've put them here just in case you might find them useful.

1. If you are using [GitHub Pages][11] as your static site host, here's a pretty clever solution that uses [Zapier][12] and calendar events to avoid using a server or VM to schedule deployments. 
   [http://blog.east5th.co/2014/12/29/scheduling-posts-with-jekyll-github-pages-and-zapier/][13]
2. This tutorial shows how to use [Rake][15] to consolidate your deployments instead of Grunt. If I weren't already using Grunt for my builds and manual deployments, I probably would have tried this.
   [http://www.jaredwolff.com/blog/schedule-jekyll-posts/][14]

**Feature Request:** Add scheduling to [Prose][16]. It would be sooooper sweet if Prose could detect that you are editing content in a "gh-pages" branch and offer the option to defer pushes until a specific point in the future. This would remove the entire deployment process *and* you could write content from anywhere! Alas, the feature doesn't exist.

## Conclusion

It takes a little bit of work, but creating a system where you can schedule static site content has lots of perks. And even though manually deploying may only take a couple of minutes each time, avoiding the context switch and being able to step away from your computer for days or weeks are worth the time to avoid repeating yourself day after day with the same mundane task.


[1]: http://blog.givingjar.org "Giving Jar Blog"
[2]: http://jekyllrb.com/ "Jekyll: A Free Static Site Generator"
[3]: https://surge.sh/ "Surge.sh: A Free Static Site Host"
[4]: https://github.com/ "GitHub: Amazing, Free Version Control"
[5]: http://gruntjs.com/ "Grunt: A JavaScript-based Task Runner"
[6]: https://www.digitalocean.com/ "Digital Ocean: Cheap and Easy Virtual Machines"
[7]: https://www.npmjs.com/ "NPM: Node Package Manager"
[8]: https://github.com/creationix/nvm "NVM: Node Version Manager"
[9]: https://www.digitalocean.com/community/tutorials/how-to-use-ssh-keys-with-digitalocean-droplets "How To Use SSH Keys with DigitalOcean Droplets"
[10]: http://code.tutsplus.com/tutorials/scheduling-tasks-with-cron-jobs--net-8800 "Scheduling Tasks with Cron Jobs"
[11]: https://pages.github.com/ "GitHub Pages: Free Static Site Hosting on GitHub"
[12]: https://zapier.com/ "Zapier: Automate Tasks"
[13]: http://blog.east5th.co/2014/12/29/scheduling-posts-with-jekyll-github-pages-and-zapier/ "Use Zapier to schedule deployments to GitHub Pages"
[14]: http://www.jaredwolff.com/blog/schedule-jekyll-posts/ "Use Rake and Cron to schedule static site deployments"
[15]: http://rake.rubyforge.org/ "Rake: A Build Program for Ruby Projects"
[16]: http://prose.io/ "Prose: A Web-based Content Editor for GitHub"
