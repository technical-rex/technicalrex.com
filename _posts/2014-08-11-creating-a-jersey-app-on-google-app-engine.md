---
layout: post
title: Creating a Jersey App on Google App Engine
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/08/11/creating-a-jersey-app-on-google-app-engine
excerpt: >
    <p>Today I started writing a web app that I hope will become a web-based version of a 2-player peg jumping game that I devised a few weeks ago. Inspiration for this game goes to my 18 month old daughter and her desire to play with her peg-hammering toy at 2 o'clock in the morning. I've settled on calling the game Pegger.</p>I'm turning the process of building the app into a tutorial series. This will be the first in the series, where we'll go through the process of creating a Jersey web app that runs on Google App Engine.
---

Today I started writing a web app that I hope will become a web-based version of a 2-player peg jumping game that I devised a few weeks ago. Inspiration for this game goes to my 18 month old daughter and her desire to play with her peg-hammering toy at 2 o'clock in the morning. I've settled on calling the game Pegger.

{% include image.html src="/img/posts/pegger/peggerinspiration.jpg" caption="Inspiration comes at a dark hour" %}

I have only dabbled with deploying to the cloud so I made it a goal to stand up a bare-bones web app and deploy it to [Google App Engine](https://appengine.google.com). And I do mean bare-bones, there won't be any user interface for this exercise besides typing a URL into your address bar and hitting Enter.

Besides deploying to the cloud, I also decided to create a [RESTish API](http://goo.gl/BFDKcs) to expose server-side functionality to the browser. For this project I'm going to attempt to use the latest versions of [Jersey](https://jersey.java.net/) (2.11), [Jackson](https://github.com/FasterXML/jackson) (2.4.1), and [Spring](http://projects.spring.io/spring-framewrk/) (4.0.6).

*Warning! In the steps below I have provided values specific to my project that must be unique in order to deploy successfully to Google App Engine. You will need to supply different values in order to follow this tutorial successfully.*

## Prereqs

Java is my strongest programming language so it was the obvious choice for creating a web app. Not only that but Google App Engine provides a nice [tutorial](https://developers.google.com/appengine/docs/java/gettingstarted/introduction) for creating a basic project using Java and Maven. I deviate enough from their tutorial that I will repeat any important steps below so you don't have to follow the link unless you want to learn more about Java on GAE.

Before I could start writing any code I needed to install a JDK and Maven. Here are the versions I decided to use:

* [JDK 1.8.0_11](http://www.oracle.com/technetwork/java/javase/downloads/index-jsp-138363.html)
* [Maven 3.2.2](http://maven.apache.org/download.cgi)

Install the JDK and make sure your `JAVA_HOME` environment variable is properly set. Then install Maven and set your `M2_HOME` environment variable. It also helps to put both `${JAVA_HOME}/bin` and `${M2_HOME}/bin` in your `PATH`.

When this is all done you should be able to run the following commands to see that both programs are runnable and of the correct versions.

{% highlight bash %}
$ mvn --version
$ java -version
{% endhighlight %}

## Create a GAE Project

In order to use Google App Engine you need a Google account. If that account is tied to a Google Apps domain (which is the case for me), then you also need to make sure that your Google account has access to Google App Engine.

If you have a Google Apps account then do the following:

1. Login to Google Apps as an administrator for your domain.
2. Find the [Google App Engine Console service](https://admin.google.com/AdminHome#AppDetails:service=Google+App+Engine+Admin+Console).
3. Change the service status from "OFF" to "ON for everyone".

If you don't have a Google Apps account or have completed the steps above then follow these steps to create a new GAE project:

1. Go to the [Google Developer Console](https://console.developers.google.com).
2. Click "Create Project" and in the box that appears enter:
   * Project Name: Pegger
   * Project ID: technicalrex-pegger-1
3. Jot down the Project ID. You will need it soon.

You now have a GAE project that you can deploy to!

## Create a Java Project

The recommended way to create a new GAE Java project is to use a Maven archetype. Follow the steps below to create a new project located in `~/projects/pegger`.

1. `cd ~/projects`
2. `mvn archetype:generate`
   * Choose `com.google.appengine.archetypes:appengine-skeleton-archetype` (Option 1 in my case)
   * groupId: `com.technicalrex.webapp`
   * artifactId: `pegger`
   * version: `1.0-SNAPSHOT` (default)
   * package: `com.technicalrex.webapp` (default)
3. Edit `pegger/pegger-ear/src/main/application/META-INF/appengine-application.xml` and replace the value "pegger" with "technicalrex-pegger-1".
4. Edit `pegger/pegger-war/src/main/webapp/WEB-INF/appengine-application.xml` and replace the value "pegger" with "technicalrex-pegger-1".
5. Edit `pegger/pom.xml` and update the `appengine.target.version` property to 1.9.8 (or whatever the latest version of the Google App Engine API is as you follow these steps).

All of the steps above are standard for any GAE Java project that you will create. However, since GAE only runs on Java 7 right now and because I installed JDK 8 there is one more change to be made before we can get to the fun stuff.

Edit `pegger/pom.xml` and add the following plugin:

{% highlight xml linenos %}
<plugin>
    <groupId>org.apache.maven.plugins</groupId>
    <artifactId>maven-compiler-plugin</artifactId>
    <version>3.1</version>
    <configuration>
        <source>1.7</source>
        <target>1.7</target>
        <encoding>UTF-8</encoding>
    </configuration>
</plugin>
{% endhighlight %}

That's it for the project creation. You can verify that all is well by running `mvn clean install` and confirming that the command completes successfully.

## Maven Dependencies

Spring and Jersey have started providing [BOMs](http://maven.apache.org/guides/introduction/introduction-to-dependency-mechanism.html#Dependency_Management) (Bill of Materials) to reduce the number of Maven dependencies that have to be maintained in your POM file. Instead of having to introduce half a dozen or more dependencies, you simply specify the BOM artifact then add in additional dependencies that the BOM does not provide. In our case we will specify BOMs for Spring and Jersey. Then we will add one additional dependency for Spring and three additional dependencies for Jersey.

Jackson does not provide a BOM that I am aware of, so it still requires a handful of dependencies. However, Jackson doesn't *require* any additional configuration besides including the appropriate JARs in your app so Jackson is still doing a lot to reduce the amount of required configuration. That being said, I will still add some Jackson configuration to demonstrate how it is done in case we want to change some default options and/or add support for third party serializers and deserializers.

To introduce these dependencies, edit `pegger/pom.xml` and make the following additions.

Define properties for each framework version:

{% highlight xml linenos %}
<spring.version>4.0.6.RELEASE</spring.version>
<jersey.version>2.11</jersey.version>
<jackson.version>2.4.1</jackson.version>
{% endhighlight %}

Import the Spring and Jersey BOMs:

{% highlight xml linenos %}
<dependencyManagement>
    <dependencies>
        <dependency>
            <groupId>org.springframework</groupId>
            <artifactId>spring-framework-bom</artifactId>
            <version>${spring.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
        <dependency>
            <groupId>org.glassfish.jersey</groupId>
            <artifactId>jersey-bom</artifactId>
            <version>${jersey.version}</version>
            <type>pom</type>
            <scope>import</scope>
        </dependency>
    </dependencies>
</dependencyManagement>
{% endhighlight %}

Finally, add the remaining dependencies that aren't covered by the BOMs. Put these in the top level dependencies block and not inside the dependency management block!

{% highlight xml linenos %}
<dependency>
    <groupId>org.springframework</groupId>
    <artifactId>spring-web</artifactId>
    <version>${spring.version}</version>
</dependency>

<dependency>
    <groupId>org.glassfish.jersey.containers</groupId>
    <artifactId>jersey-container-servlet</artifactId>
</dependency>
<dependency>
    <groupId>org.glassfish.jersey.ext</groupId>
    <artifactId>jersey-spring3</artifactId>
    <version>${jersey.version}</version>
</dependency>
<dependency>
    <groupId>org.glassfish.jersey.media</groupId>
    <artifactId>jersey-media-json-jackson</artifactId>
    <version>${jersey.version}</version>
</dependency>

<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-annotations</artifactId>
    <version>${jackson.version}</version>
</dependency>
<dependency>
    <groupId>com.fasterxml.jackson.core</groupId>
    <artifactId>jackson-databind</artifactId>
    <version>${jackson.version}</version>
</dependency>
<dependency>
    <groupId>com.fasterxml.jackson.jaxrs</groupId>
    <artifactId>jackson-jaxrs-json-provider</artifactId>
    <version>${jackson.version}</version>
</dependency>
{% endhighlight %}

## Spring Configuration

I have been wanting to try out Spring-sans-XML for a while so I decided to give it a shot today. I'm sticking with using annotations for most of the bean definitions, primarily for the convenience but also because I don't really intend to write any code that might discourage me from coupling Spring to my classes.

The `web.xml` configuration is almost as simple as defining an XML file to configure Spring:

{% highlight xml linenos %}
<context-param>
    <param-name>contextClass</param-name>
    <param-value>
        org.springframework.web.context.support.AnnotationConfigWebApplicationContext
    </param-value>
</context-param>
   
<context-param>
    <param-name>contextConfigLocation</param-name>
    <param-value>
        com.technicalrex.webapp.pegger.internal.SpringConfig
    </param-value>
</context-param>
   
<listener>
    <listener-class>
        org.springframework.web.context.ContextLoaderListener
    </listener-class>
</listener>
{% endhighlight %}

You will see that the `contextConfigLocation` points to a class instead of an XML file. Go ahead and create that class. Here's what it looks like:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.internal;

import org.springframework.context.annotation.ComponentScan;
import org.springframework.context.annotation.Configuration;

@Configuration
@ComponentScan(basePackages = "com.technicalrex.webapp.pegger")
public class SpringConfig {
}
{% endhighlight %}

Even with the package and import statements that class is way smaller than the equivalent XML. Furthermore, that's all of the Spring config that we will need right now!

## Jersey Configuration

Jersey's configuration is similar to Spring's in that we need to add some config to `web.xml` and then define a class to provide the rest.

First, add the following lines to `web.xml`:

{% highlight xml linenos %}
<servlet>
    <servlet-name>jerseyServlet</servlet-name>
    <servlet-class>
        org.glassfish.jersey.servlet.ServletContainer
    </servlet-class>
    <init-param>
        <param-name>javax.ws.rs.Application</param-name>
        <param-value>
            com.technicalrex.webapp.pegger.internal.JerseyConfig
        </param-value>
    </init-param>
    <load-on-startup>1</load-on-startup>
</servlet>
<servlet-mapping>
    <servlet-name>jerseyServlet</servlet-name>
    <url-pattern>/*</url-pattern>
</servlet-mapping>
{% endhighlight %}

Second, create the class `JerseyConfig` and register `RequestContextFilter.class` so our JAX-RS resources can be injected with Spring beans:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.internal;

import com.technicalrex.webapp.pegger.greetings.Greetings;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.spring.scope.RequestContextFilter;

public class JerseyConfig extends ResourceConfig {
    public JerseyConfig() {
        // Enable Spring DI
        register(RequestContextFilter.class);
    }
}
{% endhighlight %}

## Jackson Configuration

As mentioned earlier in this article, Jackson doesn't technically need any additional configuration but there are a couple of features enabled by default that I am not a huge fan of. In particular, `CAN_OVERRIDE_ACCESS_MODIFIERS` is nasty because it will allow incoming JSON to write to private fields regardless of whether there are public setters for them. This seems a little dangerous to me so let's make sure it's disabled.

Eventually I will want to configure some third-party serializers and deserializers. That configuration would also go in this class but for now let's keep it simple. Here's what the Jackson configuration provider looks like:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.internal;

import com.fasterxml.jackson.databind.MapperFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

import javax.ws.rs.ext.ContextResolver;
import javax.ws.rs.ext.Provider;

@Provider
public class JacksonObjectMapperConfig
        implements ContextResolver<ObjectMapper> {

    private static final ObjectMapper OBJECT_MAPPER
        = new ObjectMapper()
        .disable(MapperFeature.AUTO_DETECT_CREATORS)
        .disable(MapperFeature.CAN_OVERRIDE_ACCESS_MODIFIERS);

    @Override
    public ObjectMapper getContext(Class<?> aClass) {
        return OBJECT_MAPPER;
    }
}
{% endhighlight %}

Once you have written the `JacksonObjectMapperConfig` you will need to register it with Jersey:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.internal;

import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.spring.scope.RequestContextFilter;

public class JerseyConfig extends ResourceConfig {
    public JerseyConfig() {
        // Enable Spring DI and Jackson configuration
        register(RequestContextFilter.class);
        register(JacksonObjectMapperConfig.class);
    }
}
{% endhighlight %}

## Kick the Tires

Now that all of the configuration is in place we should make sure the three frameworks are all playing nicely with each other. I do this by defining a `/greetings` resource that calls a service injected by Spring that returns a list of greetings that Jackson will serialize into JSON.

First, create a "domain object" class named `Greeting` and slap a Jackson annotation on it:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.greetings;

import com.fasterxml.jackson.annotation.JsonValue;

public class Greeting {
    private final String text;

    public Greeting(String text) {
        this.text = text;
    }

    @JsonValue
    public String getText() {
        return text;
    }
}
{% endhighlight %}

Second, write a service that will return a list of `Greeting`s and wire it up in Spring:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.greetings;

import org.springframework.stereotype.Service;

import java.util.Arrays;

@Service
public class GreetingService {
    public Iterable<Greeting> getEnglishGreetings() {
        return Arrays.asList(
            new Greeting("Hi"),
            new Greeting("Hello"),
            new Greeting("Yo"));
    }
}
{% endhighlight %}

Finally, define a JAX-RS resource that will allow us to view those greetings in a web browser:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.greetings;

import javax.inject.Inject;
import javax.ws.rs.GET;
import javax.ws.rs.Path;
import javax.ws.rs.Produces;
import javax.ws.rs.core.MediaType;
import javax.ws.rs.core.Response;

@Path("/greetings")
@Produces(MediaType.APPLICATION_JSON)
public class Greetings {
    private final GreetingService greetingService;

    @Inject
    public Greetings(GreetingService greetingService) {
        this.greetingService = greetingService;
    }

    @GET
    public Response getGreetings() {
        return Response
            .ok(greetingService.getEnglishGreetings())
            .build();
    }
}
{% endhighlight %}

Then make sure to register the new resource in the Jersey config:

{% highlight java linenos %}
package com.technicalrex.webapp.pegger.internal;

import com.technicalrex.webapp.pegger.greetings.Greetings;
import org.glassfish.jersey.server.ResourceConfig;
import org.glassfish.jersey.server.spring.scope.RequestContextFilter;

public class JerseyConfig extends ResourceConfig {
    public JerseyConfig() {
        // Enable Spring DI and Jackson configuration
        register(RequestContextFilter.class);
        register(JacksonObjectMapperConfig.class);

        // Application resources
        register(Greetings.class);
    }
}
{% endhighlight %}

In order to test it all out you will have to build the project and run it on a local app engine server. Run these commands to do just that:

{% highlight bash %}
$ cd ~/projects/pegger
$ mvn clean install
$ cd pegger-ear
$ mvn appengine:devserver
{% endhighlight %}

Once the server is running (you will see the message "Dev App Server is now running"), navigate to `http://localhost:8080/greetings` in your browser. You should see the following text:

{% highlight js %}
[
    "Hi",
    "Hello",
    "Yo"
]
{% endhighlight %}

## Deploy to Google App Engine

If everything up to this point has worked then the next steps will be a piece of cake. We will build the project, upload it to Google App Engine, and then test that it is running correctly on Google's servers.

Build the project and upload it to Google using the following commands. The first time you run the `mvn` command you will be kicked over to a web browser window where Google will present a token to you. Copy that token and paste it into your terminal window (there will be a prompt) and then press Enter to finish the upload.

{% highlight bash %}
$ cd ~/projects/pegger/pegger-ear
$ mvn appengine:update
{% endhighlight %}

To test the app out on Google's servers you will need to navigate to `https://technicalrex-pegger-1.appspot.com/greetings`. You should see the same JSON array of greetings that you were presented with when you ran the project locally.

That's it, our initial setup is done!

## What's Next?

Standing up a brand new project can be time consuming and tedious but hopefully this example can help save you some time and effort. With Spring, Jersey, and Jackson playing nicely together it will also be very easy to start introducing new resources and services.

For most web apps though, the work doesn't end here. In the weeks to come I hope to build on this tutorial by covering the following topics:

1. Representing game state using a RESTish API and JSON.
2. Putting a UI in place using AngularJS and Bootstrap.
3. Introducing a NoSQL data source.
4. Adding accounts and authentication.
5. More?!

Stay tuned!
