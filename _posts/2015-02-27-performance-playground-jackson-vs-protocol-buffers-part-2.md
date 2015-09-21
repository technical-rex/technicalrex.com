---
layout: post
title: "Performance Playground - Jackson vs. Protocol Buffers, Part 2"
author: erik
category: programming
tags: []
permalink: /2015/02/27/performance-playground-jackson-vs-protocol-buffers-part-2
excerpt: >
    <p>In my previous article comparing the performance of FasterXML's Jackson JSON serializer and Google's Protocol Buffers, I concluded that the difference in speed is very small.</p>Wow was I wrong!
---

**Update:** *[Part 3]({{ site.baseurl }}{% post_url 2015-06-25-performance-playground-jackson-vs-protocol-buffers-part-3 %}) is available and the tides have turned! Actually it turns out I had a bug in my benchmark that was skewing the Protocol Buffer results in a pretty major way.*

In my [previous article]({{ site.baseurl }}{% post_url 2014-06-23-performance-playground-jackson-vs-protocol-buffers %}) comparing the performance of FasterXML's Jackson JSON serializer and Google's Protocol Buffers, I concluded that the difference in speed is very small.

Wow was I wrong!

## Giving Jackson a Fair Treatment

I'm revisiting the performance analysis of these two frameworks because I got a [suggestion](https://github.com/egillespie/performance-playground/issues/1) to add Jackson Afterburner as an additional benchmark from [Tatu Saloranta](https://twitter.com/cowtowncoder) and I finally got around to it today.

Adding the Afterburner tests was easy but there was little to no performance improvement. I commented as much on the GitHub issue and Tatu pretty quickly looked into it and [pointed me](http://www.cowtowncoder.com/blog/archives/2010/04/entry_396.html) in the right direction.

It turns out that I had disabled some of Jackson's default configuration for what I thought were fairly harmless reasons and this had thrown off my benchmarks right from the start! I did not deviate from the default Protocol Buffers configuration either, so I wasn't really doing an apples-to-apples comparison of these two frameworks.

## Rework

After re-enabling the default Jackson configuration (more specifically, I removed the code to disable creator auto-detection, time formatting, and overriding access modifiers) I ran the tests again and my eyes widened upon seeing the results: Jackson was consistently serializing data more than 2 times faster than Protocol Buffers and was just shy of 2 times faster for deserialization.

What a difference using the default settings can make!

## Jackson + Afterburn

Unfortunately, re-enabling the default settings for Jackson did not yield any different results in the new Afterburner tests, it still ran at approximately the same speed as vanilla Jackson.

{% include image.html align="right" src="/img/posts/afterburner.jpg" %}

I was tipped off to the problem here as well: Afterburner uses bytecode generation to optimize access to getters and setters. Since I was using immutable objects for my benchmark and not supplying a builder for Afterburner to use, it was effectively not doing anything.

And so I stripped out the references to `@JsonCreator` in my data objects and made them mutable. Alternatively, I could have kept them immutable and created builders for Jackson to use for deserialization.

This led to an additional improvement in performance over vanilla Jackson: a 6-16% increase in serialization and a 20% improvement in deserialization.

## Results

I ran the latest benchmarks on an old Windows laptop, but the relative performance differences are still apparent: Jackson JSON serializes and deserializes much faster than Protocol Buffers with only a small difference in compressed output size.

### Serialization

| Framework | Average Time (ms) | Min. Time (ms) | Max. Time (ms) | Variance |
| :-------- | ----------------: | -------------: | -------------: | :------- |
| Jackson JSON 2.5.1 | 373 | 321 | 601 | -0.14% / +0.61% |
| Jackson Afterburner JSON 2.5.1 | 357 | 313 | 587 | -0.12% / +0.64% |
| Protocol Buffers 2.6.0 | 891 | 772 | 1,402 | -0.13% / +0.57% |

### Deserialization

| Framework | Average Time (ms) | Min. Time (ms) | Max. Time (ms) | Variance |
| :-------- | ----------------: | -------------: | -------------: | :------- |
| Jackson JSON 2.5.1 | 704 | 557 | 1,421 | -0.21% / +1.02% |
| Jackson Afterburner JSON 2.5.1 | 569 | 523 | 973 | -0.08% / +0.71% |
| Protocol Buffers 2.6.0 | 1,344 | 1,173 | 2,006 | -0.13% / +0.49% |

### Compression

| Framework | Uncompressed Size (bytes) | GZip Compressed Size (bytes) | Compression Ratio |
| :-------- | ------------------------: | ---------------------------: | ----------------: |
| Jackson JSON 2.5.1 | 27,018 | 9,591 | 2.82 |
| Jackson Afterburner JSON 2.5.1 | 26,910 | 9,610 | 2.80 |
| Protocol Buffers 2.6.0 | 18,851 | 9,199 | 2.05 |

## Lessons (Re)Learned

1. Be fair when comparing frameworks.
2. Default settings are there for a reason.
3. Know what's going on under the hood!

## What's Next?

My incentive for including Afterburner today was that I heard Protocol Buffers version 3.0 should be released soon and I'm hopeful that there will be some performance improvements made. I will add the tests for Protocol Buffers 3 when it's released.

If you have suggestions for other frameworks, [let me know](mailto:erik.gillespie@gmail.com)!
