#!/bin/sh

cd /Users/egillespie/Projects/technicalrex.com.master
bundle exec jekyll build

cd ../technicalrex.com.gh-pages
rm -rf ./*
cp -r ../technicalrex.com.master/_site/* .
