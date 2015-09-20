---
layout: post
title: "Performance Playground - Jackson vs. Protocol Buffers, Part 3"
author: erik
category: programming
tags: []
permalink: /2015/06/25/performance-playground-jackson-vs-protocol-buffers-part-3
excerpt: >
    <p>Writing an apples-to-apples benchmark comparison of two very different serialization frameworks is apparently hard.</p>
    <p>In my first attempt to compare serialization performance of Jackson JSON and Google Protocol Buffers, there wasn't a huge difference. After some suggestions, I made some revisions and found Jackson to be much faster than Protocol Buffers.</p>
    A bug was recently found in the benchmarks and the effect of this bug gave Jackson a pretty unfair advantage. As you'll see, fixing the bug leads to a complete 180º in the results of these benchmarks.
---

Writing an apples-to-apples benchmark comparison of two very different serialization frameworks is apparently hard.

In my first attempt to compare serialization performance of Jackson JSON and Google Protocol Buffers, there wasn't a huge difference. After some suggestions, I made some revisions and found Jackson to be much faster than Protocol Buffers.

A [bug](https://github.com/egillespie/performance-playground/issues/7) was recently found in the benchmarks and the effect of this bug gave Jackson a pretty unfair advantage. As you'll see, fixing the bug leads to a complete 180º in the results of these benchmarks.

## The Bug, Explained

If I had paid better attention to the serialized JSON and compared it to the data types I was choosing for the serialized object's `.proto` format file, I would have seen that the Joda Time serialization of `LocalDate` objects was not converting the values to strings. Unfortunately, that was exactly what I did when I wrote the translation code to convert my value object to its corresponding -Proto class.

[Patrick Hensley](https://github.com/phensley/protobuf-vs-jackson) noticed this while taking the time to profile the benchmarks, wrote a fixed benchmark of his own, and pointed out the flaw to me.

Before fixing the bug I profiled the Google Protocol Buffers serialization to see for my own eyes. Here's what it looks like:

{% include image.html src="/img/posts/performance-playground/convert-to-string-profiler-results.png" %}

The list of methods is sorted by Total Time and you can clearly see that most of the time spent during serialization is in a variety of Joda Time method calls.

Converting those dates to strings is expensive!

## Squashing the Bug

Another observation I made while digging into the code was that the Joda Time Jackson module was serializing the dates into an array of year, month, and day, not a string or UNIX timestamp like I had expected. So in addition to fixing the Protocol Buffer conversion of dates to a string, I also needed to fix the Jackson serialization of dates to match the more natural UNIX timestamp I decided to use with Protocol Buffers.

The approach I took was to migrate away from LocalDate altogether in favor of Instant, which I'm quickly learning is the best, most compact way to represent timestamps if you don't want to wrestle with timezones (and who does?).

After making this change the profiler tells a much different story. All of the time spent serializing into Google Protocol Buffers is actually within the Google methods, not in other frameworks.

{% include image.html src="/img/posts/performance-playground/convert-to-millis-profiler-results.png" %}

And the new serialization benchmark results are pretty impressive too, Google Protocol Buffers wins the race handily this time:

| Framework | Average Time (ms) | Min. Time (ms) | Max. Time (ms) | Variance |
| :-------- | ----------------: | -------------: | -------------: | :------- |
| Jackson JSON 2.6.0-rc2 | 130 | 122 | 169 | -0.06% / +0.30% |
| Jackson Afterburner JSON 2.6.0-rc2 | 118 | 115 | 131 | -0.03% / +0.11% |
| Protocol Buffers 3.0.0-alpha-3 | 41 | 38 | 103 | -0.07% / +1.51% |

## Conclusion

Profiling: Good.
Attention to detail: Good.
Converting dates to strings: Bad.

If you want to see the rest of the benchmark results, you can read them [here](https://github.com/egillespie/performance-playground).

Also, big thanks to Patrick Hensley for noticing this bug and pointing it out to me! It's great to see this kind of scrutiny in code on the web. OSS FTW!
