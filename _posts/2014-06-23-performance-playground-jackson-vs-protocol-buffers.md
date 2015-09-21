---
layout: post
title: "Performance Playground - Jackson vs. Protocol Buffers"
author: erik
category: programming
tags: []
permalink: /2014/06/23/performance-playground-jackson-vs-protocol-buffers
excerpt: >
    I've been benchmarking the Google Protocol Buffers and Jackson JSON serialization frameworks to compare data size and serialization/deserialization performance. The results are interesting, and in an effort to share more, the source
    code has been made available too!
---

**Update 2:** *[Part 3]({{ site.baseurl }}{% post_url 2015-06-25-performance-playground-jackson-vs-protocol-buffers-part-3 %}) is available and the tides have turned! Actually it turns out I had a bug in my benchmark that was skewing the Protocol Buffer results in a pretty major way.*

**Update 1:** *I have written a [Part 2]({{ site.baseurl }}{% post_url 2015-02-27-performance-playground-jackson-vs-protocol-buffers-part-2 %}) for the Jackson JSON and Protocol Buffers performance comparison. After reverting to Jackson's default configuration, Jackson became the clear winner in serialization and deserialization performance.*

Vertafore has some pretty exciting initiatives going on right now. Part of that monumental effort has been researching technologies that will best fit our needs. My focus has revolved around a new means of app-to-app or service-to-service communication beyond our traditional [RESTish](http://goo.gl/BFDKcs) web services. We have chosen a message bus approach and are doing lots and lots of research regarding which middleware software best fits our requirements. Fortunately, comparing the performance of different middleware solutions was pretty straight forward. There are lots of benchmarks available and the vendors make it easy to install their software for evaluation.

Since message buses are concerned with routing data they don't really care what your data looks like. We, on the other hand, definitely have to worry about the data format because it has to be adopted by all software interfacing with the message bus. Furthermore, we should be able to convert our messages to and from the appropriate format as quickly as possible. We chose a screaming fast message bus solution so it would be a shame to choose a serialization framework that becomes a bottleneck.

We have been using [JSON](http://json.org) and [Jackson](https://github.com/FasterXML/jackson) in many of our products so they were our natural first choice. Jackson is also wickedly fast compared to [other JSON mapping frameworks](http://www.cowtowncoder.com/blog/archives/2009/09/entry_326.html).  What I didn't know was how well Jackson would hold up to non-JSON message formats. Our Senior Software Architect suggested we consider Protocol Buffers for the comparison.

[Protocol Buffers](https://developers.google.com/protocol-buffers/) is a data format and serialization framework developed by Google and is licensed under the [Creative Commons Attribution 3.0 License](http://creativecommons.org/licenses/by/3.0/). It is used by practically all of their developers. The claim is that Protocol Buffers are faster, smaller, and simpler than XML. But how does it compare to Jackson JSON serialization?

Before diving into code and creating my own benchmarks I searched the net. I was surprised to only find [one article](http://ubikapps.net/?p=525) that attempted to compare Jackson and Protocol Buffers. It covered deserialization but lacked a lot of other detail that I wanted:

* Serialization **and** deserialization performance.
* Compression metrics.
* High volume averages for judging consistency.
* Documentation or code to repeat the benchmarks.

The article concluded that the deserialization performance between Jackson and Protocol Buffers was negligible. The results were interesting but I was left wanting more so I decided to write some of my own benchmarks.

I first created a Java class to hold a large number of attributes using a variety of primitives, collections, strings, and third party data types. Then I wrote a factory that would construct one of these objects and seed it with random data and consistently large collections of 100 elements. For each performance benchmark I serialized or deserialized 1,000 of these objects and collected the minimum, maximum, and average time spent. I also wrote a benchmark to determine how well each of the message formats compresses using GZip. Lastly, I wrote unit tests to make sure that serialization and deserialization resulted in matching objects so I knew the mappings were working correctly.

You can find [the source code](https://github.com/egillespie/performance-playground) to reproduce these benchmarks on GitHub.

## Results

| Benchmark | Average Time (ms) | Min. Time (ms) | Max. Time (ms) |
| :-------- | ----------------: | -------------: | -------------: |
| Jackson JSON Serialization | 521 | 506 | 725 |
| Google Protocol Buffers Serialization | 535 | 518 | 724 |
| Jackson JSON Deserialization | 912 | 891 | 1,144 |
| Google Protocol Buffers Deserialization | 880 | 861 | 993 |

The table above shows the respective time spent serializing/deserializing with each framework. The results show that Jackson serializes into JSON marginally faster than Google's framework serializes into protocol buffers, but Google's deserialization is marginally faster than Jackson. The combined time spent serializing and deserializing by Jackson and Google Protocol Buffers is 1,433 milliseconds and 1,415 milliseconds respectively. Overall it appears that Protocol Buffers are only slightly faster than Jackson. And by "slightly" I mean 1% faster.

| Benchmark | Uncompressed Size (bytes) | GZip Compressed Size (bytes) | Compression Ratio |
| :-------- | ------------------------: | ---------------------------: | ----------------: |
| Jackson JSON Serialization | 28,064 | 9,747 | 2.88 |
| Google Protocol Buffer Serialization | 18,827 | 9,252 | 2.03 |

Here we see that, when uncompressed, Protocol Buffers are smaller in size than JSON (in this case by nearly 10 kilobytes or 33%). The difference becomes less substantial after compression though. A compressed Protocol Buffer ends up being just 495 bytes (5%) smaller than compressed JSON. This isn't too surprising though. Since JSON is a plain-text data format we would expect it to compresses well. Protocol Buffers, on the other hand, are a mix of binary and text and are designed to be small. They wouldn't have the same opportunities for compression.

There was one other observation I made while writing the code to gather these benchmarks: Jackson is much easier to configure and start developing with than Google Protocol Buffers.  Consider the steps I had to go through before I could start using these frameworks:

### **Using Jackson JSON Mapping**

1. Add the appropriate Maven dependencies.
2. Disable unwanted features in Jackson's `ObjectMapper`.
3. Register Guava and Joda Time modules.
4. Annotate the constructors in `TestObject`.

Configuring and developing with Jackson is easy. The only time you really have to worry about Jackson is when you create a new object but even in that case you just throw some annotations on the constructor and its parameters. You barely break pace while writing the class.

### **Using Google Protocol Buffer Mapping**

1. Add the appropriate Maven dependencies.
2. Install `protoc`, the protocol buffer compiler.
3. Define a `.proto` file that describes the protocol buffer format for `TestObject`.
4. Invoke `protoc` during the Maven build process to generate the protocol buffer wrapper classes.
5. Write translation code to convert `TestObject` to/from the protocol buffer wrapper classes.

I didn't really mind installing `protoc` or configuring it to be invoked by Maven. Those are chores you only do once and then are done with forever. Defining the `.proto` file was interesting but after I used it to generate a Protocol Buffer class it occurred to me that I would have to write one of those definition files for every class I wanted to serialize. When it dawned on me I also had to write a translator to go to and from my `TestObject` class, it really hit me: if we used Google Protocol Buffers we would have to write two extra files for every serializable class we create!

Google doesn't hide that fact but it's still a lot of work to take on when you are used to sprinkling in some annotations here and there to get your mapping to work. I suppose you could use the generated Protocol Buffer classes as your domain objects but they're cumbersome to work with, especially when you're working with collections or arrays.

## Conclusion

The performance differences between Jackson and Google Protocol Buffers is VERY small. Google only has a slight edge over Jackson in terms of deserialization speed. It's difficult to imagine a scenario where that slight improvement in performance alone would justify choosing Google's solution over Jackson.

If the size of messages are important though, Protocol Buffers have a bigger advantage only when the messages are uncompressed. After compression though, Protocol Buffers are only slightly smaller in size than JSON. If you have size constraints either over the wire or because of storage and you are using JSON, you may want to consider compressing the data before taking on the large effort of switching to Protocol Buffers.

Besides these two benchmarks, the development effort required to use Protocol Buffers should be considered. There is a noticeable amount of extra work involved in order to use them and that work will not be once-and-done, it will be there each time you need to create a new Protocol Buffer object.

All in all we decided that the performance and size differences were not significant enough for our current and future needs to justify switching to Google Protocol Buffers. I didn't even document the extra work that the switch would require because all things equal, our teams are more familiar with JSON and Jackson than with Google Protocol Buffers. It's also not inconceivable that our messages may need to be presented in a browser. JSON is a more natural fit there as well.
