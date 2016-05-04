---
layout: post
title: "Spring Security and JWT - Clearer, Safer, Verifiable"
author: erik
category: programming
tags: [java,jwt,jjwt,spring-security,tutorial]
permalink: /spring-security-jwt-followup
preview-image: /img/posts/verifiable-jwt.jpg
excerpt: >
    <p>If you are familiar with my Stateless Authentication with Spring Security
    and JWT tutorial, you may be pleased to know that I made the example a
    little safer, fixed a bug that prevented tokens from being inspected with
    third-party tools, and wrote better setup instructions</p>Keep reading for
    more details, including links to specs and a cool online JWT debugger!
---

***Note:*** This is a follow-up to the [Stateless Authentication with Spring Security and JWT][1] tutorial. If you're here to see what's changed since then, read on! Otherwise, you may want to read the original tutorial first and then come back to this article to see what's changed.

If you want to skip the explanation and just look at the code changes, [click here][5].

## Stronger Tokens

An observant fellow by the name of [Florian Schmitt][2] noticed in my original tutorial that the same token is always generated for a given username. This is worrisome because it increases the risk that a user's credentials or even the application's secret key will be compromised!

To reduce this risk, we can add *entropy* to the token &mdash; data that an attacker cannot predict that is different from our secret key &mdash; and we can minimize the time in which someone can use a token.

Florian had some great suggestions that are really easy to implement using [JJWT][3]. Here's what the new token generator looks like:

**TokenHandler.java**

{% highlight java linenos %}
public String createTokenForUser(User user) {
    Date now = new Date();
    Date expiration = new Date(now.getTime() + TimeUnit.HOURS.toMillis(1l));
    return Jwts.builder()
            .setId(UUID.randomUUID().toString())
            .setSubject(user.getUsername())
            .setIssuedAt(now)
            .setExpiration(expiration)
            .signWith(SignatureAlgorithm.HS512, secret)
            .compact();
}
{% endhighlight %}

## Less Buggy Tokens

Florian also noticed I wasn't Base64-encoding the secret key when signing the tokens. D'oh! This violation of [the spec][7] might prevent alternative JWT frameworks within your application's ecosystem from properly verifying tokens.

Fortunately, this is a one-line fix to the token handler's constructor:

**TokenHandler.java**
{% highlight java linenos %}
public TokenHandler(String secret, UserService userService) {
    this.secret = Base64.getEncoder().encodeToString(StringConditions.checkNotBlank(secret).getBytes());
    this.userService = Preconditions.checkNotNull(userService);
}
{% endhighlight %}

The fix can be verified by pasting one of the tutorial's generated tokens into [JWT.io][4] and typing in the default secret key "tooManySecrets". Notice the giant "Signature Verified" message in the image below.

{% include image.html src="/img/posts/verifiable-jwt.jpg" caption="Don't trust me, try it for yourself!" %}

## Authenticating with Google

After going months without thinking about this tutorial, it was a struggle for me to figure out how to generate Google OAuth credentials to use in this example. To save myself and others the agony of figuring that out again,
I also added better instructions to the tutorial's [README][6] in GitHub.
 

[1]: /2015/02/20/stateless-authentication-with-spring-security-and-jwt "Tutorial: Stateless Authentication with Spring Security and JWT"
[2]: https://github.com/florianschmitt "Florian Schmitt's Public GitHub Profile"
[3]: https://github.com/jwtk/jjwt "JJWT on GitHub"
[4]: https://jwt.io "JWT.IO - An Online JWT Debugger"
[5]: https://github.com/technical-rex/spring-security-jwt/compare/4e9dc4e6b8f53ce49dcf7dd527df8fc7fac927cd...a2d0b67c26e4e20f64e8d95ae827f7522218447b "Code review the changes to this tutorial"
[6]: https://github.com/technical-rex/spring-security-jwt "Better setup instructions for spring-security-jwt on GitHub"
[7]: https://tools.ietf.org/html/rfc7519 "JSON Web Token RFC"
