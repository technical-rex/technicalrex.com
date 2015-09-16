---
layout: post
title: RestEasy and Spring 4 - The Break Up
author: erik
category: programming
tags: []
permalink: /2014/06/30/resteasy-and-spring-4-the-break-up
excerpt: >
    I have created enough projects from scratch that use Spring and RestEasy that I can crank out all of the code and XML by hand. That's what I thought anyway, until I decided to try out Spring 4 in one of these new projects.
---

**Edit:** *The bug discussed in this article has been addressed in spring-resteasy 3.0.9.Final. Read through though! The intent of this article is to demonstrate why it is important to use `@Override` to avoid such bugs.*

I have created enough projects from scratch that use [Spring](http://projects.spring.io/spring-framework/) and [RestEasy](http://resteasy.jboss.org) that I can crank out all of the code and XML by hand. That's what I thought anyway, until I decided to try out Spring 4 in one of these new projects.

The typical steps I go through to create a new project with Spring and RestEasy are pretty straight forward:

1. Add Maven dependencies for RestEasy, Spring, and RestEasy-Spring integration.
2. Register the RestEasy dispatcher filter, bootstrap listener, and SpringContextLoaderListener provided by the RestEasy-Spring integration dependency.
3. Tell Spring to use annotations to register all of the beans that will be used.
4. Create a simple `@GET` resource with a `@Path`.
5. Build, deploy, verify.

Weeeeeeell, if I had simply upgraded an old project from Spring 3 to Spring 4 I would have quickly discovered that RestEasy would stop registering all resources defined in Spring beans. I didn't do that though. Instead, I created a new project coding totally blind [thinking it would be safe and fun](http://www.theserverside.com/feature/Rod-Johnson-Speaks-of-Method-Deprecation-and-Backwards-Compatability) to use Spring 4. When I got a 404 Not Found on my test resource I assumed that I had made a mistake somewhere.

{% include image.html src="/img/posts/keyboardsmash.gif" align="left" %}

I spent the next few hours banging my face on my keyboard trying to figure out which important detail I had left out. I swapped out RestEasy's filter for a servlet, I replaced Spring's `@Component` stereotype annotation with Java's `@Resource`, I put a dummy JSP in the application to make sure Jetty wasn't issuing 404 responses to everything. I changed the log level for all RestEasy packages to DEBUG, wrote a servlet that would dump out every end point that RestEasy knew about, and when I got really desperate, I downloaded the source code for RestEasy and started stepping through line by line to figure out why it wasn't picking up my resource.

It's amazing that I could run into the problem of RestEasy not registering resources defined with Spring annotations and find so many possible solutions that it could keep me busy for so long! Some of the failed attempts totally led me astray with quirky false positive results too. For example, when I swapped out the RestEasy filter for the equivalent servlet I still received 404 but no HTML was returned in the response, giving me a blank page instead. The original 404 showed a generic Jetty error page and without Chrome Dev Tools open I thought the blank page was actually a 200 response. Alas, it was not.

Eventually I came across [RESTEASY-1012](https://issues.jboss.org/browse/RESTEASY-1012) on JBoss's bug tracker. At the time of this writing, that issue is still unresolved, but it provides a hack that will work until RestEasy's Spring integration is fixed.

You see this guy?

{% highlight xml linenos %}
<listener>
  <listener-class>
    org.jboss.resteasy.plugins.spring.SpringContextLoaderListener
  </listener-class>
</listener>
{% endhighlight %}

Yeah... so... that guy doesn't work any more... but it compiles, links, and runs without throwing any exceptions. RestEasy and Spring 4 just stopped talking to each other one day without even bothering with an official divorce.

Fortunately, the JIRA issue provides workaround code. You need to write your own listener and use it in place of `SpringContextLoaderListener`. It'll look something like this:

{% highlight java linenos %}
public class SpringRestEasyContextLoaderListener
        extends ContextLoaderListener {

    private SpringContextLoaderSupport springLoader
        = new SpringContextLoaderSupport();

    @Override
    protected void customizeContext(ServletContext sc,
            ConfigurableWebApplicationContext ctxt) {
        super.customizeContext(sc, ctxt);
        this.springLoader.customizeContext(sc, ctxt);
    }
}
{% endhighlight %}

The JIRA also explains that the RestEasy-Spring link is severed because Spring 4 removed the deprecated `createContextLoader` method on `ContextLoaderListener`. A comparison of the source code for this class in Spring 3.0.5 and Spring 4.0.5 confirmed that Spring did indeed remove the method. So why didn't RestEasy's `SpringContextLoaderListener` just break outright?

It has to do with the [`@Override`](http://docs.oracle.com/javase/1.5.0/docs/api/java/lang/Override.html) annotation. Or in this case, the lack of it. RestEasy's `SpringContextLoaderListener` extends Spring's own `ContextLoaderListener` and overrides the `createContextLoader`. It has been doing this since the class was originally introduced in resteasy-spring 1.0.0.GA yet the `@Override` has never existed on that method!

If `createContextLoader` was marked with `@Override` then a compiler error would have been presented the moment the resteasy-spring module was built using Spring 4. Since JBoss is probably interested in claiming compatibility with the ever-popular Spring framework, that build probably happened before Spring 4 was even released. Unfortunately, the bug was not identified until after the RestEasy 3.0.6 release.

This is an excellent example of why `@Override` should be used [whenever](http://docs.oracle.com/javase/tutorial/java/IandI/override.html) [possible](http://stackoverflow.com/questions/94361/when-do-you-use-javas-override-annotation-and-why#94411).
