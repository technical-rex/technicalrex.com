---
layout: post
title: Stateless Authentication with Spring Security and JWT
author: erik
category: programming
tags: [java,jwt,jjwt,spring-security,tutorial]
permalink: /2015/02/20/stateless-authentication-with-spring-security-and-jwt
preview-image: /img/posts/cookiemonster-nocookiesforyou.jpg
excerpt: >
    <p>As part of my lifelong study of REST APIs I have been learning more about avoiding shared state between the client and server. This week in particular I have been learning about stateless authentication and attempting to implement it in a skeleton Java app based on my Jersey on Google AppEngine tutorial.</p>I've decided to use Spring Security and JWT to pull it off.
---

***Update 2:*** Things have been fixed and better setup instructions have been written! [Read the follow-up article](/spring-security-jwt-followup).

***Update 1:*** The code used for this tutorial is now [available on GitHub](https://github.com/technical-rex/spring-security-jwt)! Peruse, fork, and clone as you see fit.

As part of my lifelong study of REST APIs I have been learning more about [avoiding shared state](http://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm#sec_5_1_3) between the client and server. This week in particular I have been learning about stateless authentication and attempting to implement it in a skeleton Java app based on my [Jersey on Google AppEngine tutorial]({{ site.baseurl }}{% post_url 2014-08-11-creating-a-jersey-app-on-google-app-engine %}).

## Overview

The REST architectural style is interesting to me, but that alone is not why I want to implement a stateless authentication mechanism. Benefits that Roy Fielding states in his dissertation include reliability and scalability. When building a web application, reliability is important no matter how many users you have. Scalability is also important for even a meager number of users.

Another benefit of statelessness when building a RESTful web application that is important to me is testability. It is much easier to test endpoints without first having to go through a workflow to establish a session and then end that session after the test to ensure the tests are isolated. This will probably result in time savings during the development of the app as well.

One of the downsides of statelessness is that it requires some form of token or credential to be supplied with **every** request to the server, which can be a performance penalty. [JWT](https://tools.ietf.org/html/rfc7519) (JSON Web Tokens) are a means of offering stateless authentication in a compact and secure way. JSON Web Tokens can be used to thwart cross-site request forgery attempts and there are plenty of JWT libraries out there as well.

While there may be a performance penalty to stateless authentication, I think the compactful, secure, easy-to-use JWT balances out that con quite nicely. Another benefit of JWT is that it does not require the use of cookies, which makes server-to-server authentication more convenient.

{% include image.html src="/img/posts/cookiemonster-nocookiesforyou.jpg" caption="No Cookies for You!" %}

## Where to Begin

I set out to use [Spring Security](http://projects.spring.io/spring-security/) because it is very customizable and is usually not very invasive to the rest of your web application. I also have a lot of experience with it so it's typically a good place for me to start when looking into any new security-related solutions.

Spring Security does offer [its own approach to JWT](https://github.com/spring-projects/spring-security-oauth/tree/master/spring-security-jwt) too, but I decided not to use it because until recently it had not seen much activity. Instead, I chose to use [JJWT](https://github.com/jwtk/jjwt), which provides a brilliant fluent interface for using JSON Web Tokens.

After choosing my tech stack for this little project I perused the Internet to see if anyone had already accomplished what I was setting out to do. I found this [JDriven article](http://blog.jdriven.com/2014/10/stateless-spring-security-part-2-stateless-authentication/) by Robbert van Waveren that comes pretty darn close. It turned out to be a great starting point!

The code provided below is an adaptation of Robbert's tutorial to use JWT. I made some small changes to bootstrap the app in a Google AppEngine app instead of using Spring Boot so I'll point out those differences as well.

## Code Time!

First things first, let's pull in the Maven dependencies for Spring Security and JJWT.

**pom.xml**

{% highlight xml linenos %}
<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-web</artifactId>
    <version>3.2.5.RELEASE</version>
</dependency>

<dependency>
    <groupId>org.springframework.security</groupId>
    <artifactId>spring-security-config</artifactId>
    <version>3.2.5.RELEASE</version>
</dependency>

<dependency>
    <groupId>io.jsonwebtoken</groupId>
    <artifactId>jjwt</artifactId>
    <version>0.4</version>
</dependency>
{% endhighlight %}

Since I'm using a Servlet 2.5 container running in Google AppEngine, I'll have to configure the Spring Security filter in web.xml too.

**web.xml**

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
        com.technicalrex.skeleton.vendor.SpringSecurityConfig
    </param-value>
</context-param>

<filter>
    <filter-name>springSecurityFilterChain</filter-name>
    <filter-class>org.springframework.web.filter.DelegatingFilterProxy</filter-class>
</filter>

<filter-mapping>
    <filter-name>springSecurityFilterChain</filter-name>
    <url-pattern>/*</url-pattern>
    <dispatcher>REQUEST</dispatcher>
</filter-mapping>

<listener>
    <listener-class>org.springframework.web.context.ContextLoaderListener</listener-class>
</listener>
{% endhighlight %}

Now that Spring Security is bootstrapping I need to define the SpringSecurityConfig. This class will declare any security-related Spring beans and configure the base HTTP filter to secure the web application.

**SpringSecurityConfig.java**

{% highlight java linenos %}
@Configuration
@EnableWebSecurity
@Order(2)
public class SpringSecurityConfig extends WebSecurityConfigurerAdapter {

    private final UserService userService;
    private final TokenAuthenticationService tokenAuthenticationService;

    public SpringSecurityConfig() {
        super(true);
        this.userService = new UserService();
        tokenAuthenticationService = new TokenAuthenticationService("tooManySecrets", userService);
    }

    @Override
    protected void configure(HttpSecurity http) throws Exception {
        http
                .exceptionHandling().and()
                .anonymous().and()
                .servletApi().and()
                .headers().cacheControl().and()
                .authorizeRequests()

                // Allow anonymous resource requests
                .antMatchers("/").permitAll()
                .antMatchers("/favicon.ico").permitAll()
                .antMatchers("**/*.html").permitAll()
                .antMatchers("**/*.css").permitAll()
                .antMatchers("**/*.js").permitAll()

                // Allow anonymous logins
                .antMatchers("/auth/**").permitAll()

                // All other request need to be authenticated
                .anyRequest().authenticated().and()

                // Custom Token based authentication based on the header previously given to the client
                .addFilterBefore(new StatelessAuthenticationFilter(tokenAuthenticationService),
                        UsernamePasswordAuthenticationFilter.class);
    }

    @Override
    protected void configure(AuthenticationManagerBuilder auth) throws Exception {
        auth.userDetailsService(userDetailsService()).passwordEncoder(new BCryptPasswordEncoder());
    }

    @Bean
    @Override
    public AuthenticationManager authenticationManagerBean() throws Exception {
        return super.authenticationManagerBean();
    }

    @Bean
    @Override
    public UserService userDetailsService() {
        return userService;
    }

    @Bean
    public TokenAuthenticationService tokenAuthenticationService() {
        return tokenAuthenticationService;
    }
}
{% endhighlight %}

There are a number of important details in this class that are worth understanding:

1. In the constructor, disable the default security configuration.
2. In the constructor the string "tooManySecrets" should be replaced with a value private to your application and ideally loaded from a property file.
3. Anonymous access is allowed but authorization will happen on all HTTP requests.
4. Prevent the browser/client from caching responses.
5. Allow anonymous access to all static resources (HTML, CSS, JS, etc.).
6. Also allow anonymous access to login attempts (this assumes logins are managed under /auth).
7. Authentication must occur on requests to all other resources.
8. A single filter will be used to authenticate all requests that require authentication.

This configuration shows that there are a handful of other classes needed in order to implement stateless authentication. The filter is where the actual authentication is managed though so let's look at that one first.

**StatelessAuthenticationFilter.java**

{% highlight java linenos %}
public class StatelessAuthenticationFilter extends GenericFilterBean {

    private final TokenAuthenticationService authenticationService;

    public StatelessAuthenticationFilter(TokenAuthenticationService authenticationService) {
        this.authenticationService = authenticationService;
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain filterChain)
            throws IOException, ServletException {
        HttpServletRequest httpRequest = (HttpServletRequest) request;
        Authentication authentication = authenticationService.getAuthentication(httpRequest);
        SecurityContextHolder.getContext().setAuthentication(authentication);
        filterChain.doFilter(request, response);
        SecurityContextHolder.getContext().setAuthentication(null);
    }
}
{% endhighlight %}

There's not much here because this filter actually delegates to `TokenAuthenticationService`. All this filter really does is apply the successful authentication to Spring Security's context holder and then proceed with the request.

Okay, let's dig a little deeper and look at `TokenAuthenticationService`.

**TokenAuthenticationService.java**

{% highlight java linenos %}
public class TokenAuthenticationService {

    private static final String AUTH_HEADER_NAME = "X-AUTH-TOKEN";

    private final TokenHandler tokenHandler;

    public TokenAuthenticationService(String secret, UserService userService) {
        tokenHandler = new TokenHandler(secret, userService);
    }

    public void addAuthentication(HttpServletResponse response, UserAuthentication authentication) {
        final User user = authentication.getDetails();
        response.addHeader(AUTH_HEADER_NAME, tokenHandler.createTokenForUser(user));
    }

    public Authentication getAuthentication(HttpServletRequest request) {
        final String token = request.getHeader(AUTH_HEADER_NAME);
        if (token != null) {
            final User user = tokenHandler.parseUserFromToken(token);
            if (user != null) {
                return new UserAuthentication(user);
            }
        }
        return null;
    }
}
{% endhighlight %}

This is where things start to become more clear about how authentication will actually work! When a user successfully logs into the web application, the first public method of this class will be called to create a token for that user. That token is then added as a header with the key "X-AUTH-TOKEN" to the outbound response.

The authentication filter is calling `getAuthentication(...)` though, which looks for a header that uses the same key "X-AUTH-TOKEN" and uses that token to re-establish the authenticating user. If this method throws an exception or returns `null` then the user will not be authenticated and the request will ultimately fail.

Robbert's article conveniently delegated the token generation and parsing to yet another class to isolate that logic. My implementation of `TokenHandler` uses JJWT to manage a JSON Web Token. Here's what it looks like:

**TokenHandler.java**

{% highlight java linenos %}
public final class TokenHandler {

    private final String secret;
    private final UserService userService;

    public TokenHandler(String secret, UserService userService) {
        this.secret = secret;
        this.userService = userService;
    }

    public User parseUserFromToken(String token) {
        String username = Jwts.parser()
                .setSigningKey(secret)
                .parseClaimsJws(token)
                .getBody()
                .getSubject();
        return userService.loadUserByUsername(username);
    }

    public String createTokenForUser(User user) {
        return Jwts.builder()
                .setSubject(user.getUsername())
                .signWith(SignatureAlgorithm.HS512, secret)
                .compact();
    }
}
{% endhighlight %}

This is where the magic of JJWT happens. In a single chain of calls to its fluent API, JJWT will create a token using the subject of our choosing (username) and sign it using the application's secret key. All of the other work of generating appropriately structured JSON according to the even more specific JWT specification, Base 64 encoding, and compaction are all taken care of behind the scenes.

The reverse is true too. JJWT can also use a secret key to fully decode and parse a JSON Web Token and provide an object that we can use to later retrieve the subject (username) needed to verify the presence of a real user.

The only remaining classes are nothing special (they'll be needed in many Spring Security applications that involve a user login) so I will provide them below for completeness.

**UserService.java**

{% highlight java linenos %}
public class UserService implements org.springframework.security.core.userdetails.UserDetailsService {

    private final AccountStatusUserDetailsChecker detailsChecker = new AccountStatusUserDetailsChecker();
    private final HashMap<String, User> userMap = new HashMap<String, User>();

    @Override
    public final User loadUserByUsername(String username) throws UsernameNotFoundException {
        final User user = userMap.get(username);
        if (user == null) {
            throw new UsernameNotFoundException("user not found");
        }
        detailsChecker.check(user);
        return user;
    }

    public void addUser(User user) {
        userMap.put(user.getUsername(), user);
    }
}
{% endhighlight %}

This implementation of Spring Security's `UserDetailsService` is for demonstration purposes only! It uses a map to maintain the set of available users and it isn't even thread safe. If you are using this tutorial you will most certainly want to replace this with a user lookup service that uses a database, LDAP, or some other more legitimate means of keeping track of users.

**UserAuthentication.java**

{% highlight java linenos %}
public class UserAuthentication implements Authentication {

    private final User user;
    private boolean authenticated = true;

    public UserAuthentication(User user) {
        this.user = user;
    }

    @Override
    public String getName() {
        return user.getUsername();
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return user.getAuthorities();
    }

    @Override
    public Object getCredentials() {
        return user.getPassword();
    }

    @Override
    public User getDetails() {
        return user;
    }

    @Override
    public Object getPrincipal() {
        return user.getUsername();
    }

    @Override
    public boolean isAuthenticated() {
        return authenticated;
    }

    @Override
    public void setAuthenticated(boolean authenticated) {
        this.authenticated = authenticated;
    }
}
{% endhighlight %}

This class implements Spring Security's `Authentication` interface, which is how Spring ties users, authorities/roles, principals, credentials, and authentication status together. The implementation above always assumes the user is authenticated and delegates the rest to Spring Security's own `User` class.

## Conclusion

Robbert van Waveren's article saved me from a lot of the grunt work of configuring Spring Security to handle stateless authentication. Swapping out his own HMAC signing code with the one-liners offered up by JJWT helped me cut out a lot of code and use a full-blown JWT implementation as well!

All in all, this is probably one of the smallest Spring Security implementations that I have done. I don't know why I didn't try this out sooner!
