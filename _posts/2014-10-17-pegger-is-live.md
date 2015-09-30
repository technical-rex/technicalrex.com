---
layout: post
title: Pegger is Live!
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/10/17/pegger-is-live
excerpt: >
    The finishing touches have been made and I think it's time to call Pegger "good enough". Read on for some changes I made to the code to put that last bit of polish on this wittle web app.
---

The finishing touches have been made and I think it's time to call Pegger ["good enough"](http://en.wikipedia.org/wiki/Principle_of_good_enough).

You can play Pegger at it's permanent home: [pegger.technicalrex.com](http://pegger.technicalrex.com). If you want to learn more about those finishing touches, read on!

## User Experience Tweaks

After the [previous tutorial]({{ site.baseurl }}{% post_url 2014-10-01-using-bootstrap-and-angularjs-for-a-simple-turn-based-game %}) Pegger was still pretty rough around the edges. The game was playable but only if you could figure out the rules by guessing or were brave enough to check out the source code or README on [GitHub](https://github.com/egillespie/pegger).

Besides a lack of rules there were a few broken links and as a user on [Reddit](http://www.reddit.com/r/programming/comments/2hzoml/a_simple_turnbased_game_client_using_bootstrap/) pointed out, it was unclear that the white circles were holes and not interactive.

The interface has been cleaned up and all of the aforementioned issues have been addressed.

The rules are now on permanent display below the game board with small peg icons displayed where appropriate to draw attention to differences between the various colors of pegs and the white holes.

The game board has been touched up too. Namely,

1. The current player is displayed seamlessly in the upper right corner.
2. Game messages are displayed at the bottom of the board and are much less distracting.
3. The mouse pointer changes only when hovering over an interactive hole or peg.
4. Selecting a different peg actually works now instead of displaying an error.

All links are now valid too. Instead of mixing the tutorial/code part of Pegger with the rules, the Tutorial and GitHub links were moved to the upper right of the page to be more prominently displayed but still out of the way from the game play.

## Cleaning Up Old Games

Since Pegger does not use any permanent storage it is important to keep the in-memory repository small as it will inevitably grow in size over time. This was handled by tracking the time that each game was last updated and introducing a scheduled task in the Pegger web app.

To track the time that each game changed, first I added Joda Time and a Jackson module to allow us to include the new field in our JSON as Maven dependencies:

**pegger-war/pom.xml**

{% highlight xml linenos %}
<dependencies>
    <dependency>
        <groupId>joda-time</groupId>
        <artifactId>joda-time</artifactId>
        <version>2.5</version>
    </dependency>
    <dependency>
        <groupId>com.fasterxml.jackson.datatype</groupId>
        <artifactId>jackson-datatype-joda</artifactId>
        <version>2.4.3</version>
    </dependency>

    ...
</dependencies>
{% endhighlight %}

Then, the Joda Time module needed to be included in the Jackson ObjectMapper configuration:

**JacksonObjectMapperConfig.java**

{% highlight java linenos %}
public class JacksonObjectMapperConfig implements ContextResolver<ObjectMapper> {
    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper()
            .disable(MapperFeature.AUTO_DETECT_CREATORS)
            .disable(MapperFeature.CAN_OVERRIDE_ACCESS_MODIFIERS)
            .registerModule(new GuavaModule())
            .registerModule(new JodaModule());

    // ...
}
{% endhighlight %}

Finally, I added the field to the Game class. Here are the relevant changes:

**Game.java**

{% highlight java linenos %}
public class Game {
    // ...

    private final Instant lastChangeTimestamp;

    private Game(UUID gameId, Peg lastPegMoved, ImmutableSet<Peg> pegs) {
        this.gameId = Preconditions.checkNotNull(gameId);
        this.lastPegMoved = Optional.fromNullable(lastPegMoved);
        this.pegs = Maps.uniqueIndex(Preconditions.checkNotNull(pegs), PEG_INDEXER);
        this.gameOver = calculateGameOver();
        this.lastChangeTimestamp = Instant.now();
        validateGameState();
    }

    // ...

    public Instant getLastChangeTimestamp() {
        return lastChangeTimestamp;
    }

    // ...

    @Override
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("gameId", gameId)
                .add("lastPegMoved", lastPegMoved)
                .add("gameOver", gameOver)
                .add("lastChangeTimestamp", lastChangeTimestamp)
                .add("pegs", pegs)
                .toString();
    }
}
{% endhighlight %}

With the tracking of the time that each game last changed in place, the last piece (and it's a big one) is to automatically remove old games every so often. Since Pegger is hosted in Google App Engine, I decided to use their [task scheduler](https://cloud.google.com/appengine/docs/java/config/cron) to do this.

Google's Task Scheduler fits in nicely with the HTTP API approach that I used with Pegger. In order to schedule a task, I simply needed to create a new resource that will respond to an HTTP GET request and the scheduler will automatically make requests to this URI at whatever interval I decide. This also means that I can manually invoke the task by entering the correct URL in a browser.

The first step to introduce this task is to create a new file named `cron.xml` that outlines the name of the new resource and how frequently it will be invoked.

**pegger-war/src/main/webapp/WEB-INF/cron.xml**

{% highlight xml linenos %}
<?xml version="1.0" encoding="UTF-8"?>
<cronentries>
<cron>
<url>/tools/clean_games</url>
<description>Remove old games every 12 hours</description>
<schedule>every 12 hours</schedule>
</cron>
</cronentries>
{% endhighlight %}

Looks weird, right? I discovered that there is a bug in Google App Engine that prevents some people from uploading their `cron.xml` file to App Engine unless all preceding whitespace is removed. Unfortunately, it happened to me so I removed the whitespace and recommend that you do the same, just in case. [More info about the bug here.](https://code.google.com/p/googleappengine/issues/detail?id=1537)

I decided to separate this resource out from all of the resources available at `/games` which will be handy for securing this resource (which I will do later in this tutorial). The other decision here was that the clean-up resource would be requested every 12 hours.

Next, I created the new resource and made sure Jersey knew about it:

**com/technicalrex/webapp/pegger/api/ToolResource.java**

{% highlight java linenos %}
@Path("/tools")
@Produces(MediaType.APPLICATION_JSON)
public class ToolResource {
    private final GameTools gameTools;

    @Inject
    public ToolResource(GameTools gameTools) {
        this.gameTools = Preconditions.checkNotNull(gameTools);
    }

    @GET
    @Path("clean_games")
    public Response cleanOldGames(@QueryParam("maxAgeInHours") Long maxAgeInHours) {
        int gamesRemoved;
        if (maxAgeInHours == null) {
            gamesRemoved = gameTools.removeOldGames();
        } else {
            gamesRemoved = gameTools.removeOldGames(maxAgeInHours);
        }
        return Response.ok(ImmutableMap.of("removed", gamesRemoved)).build();
    }
}
{% endhighlight %}

**JerseyConfig.java**

{% highlight java linenos %}
public class JerseyConfig extends ResourceConfig {
    public JerseyConfig() {
        // ...

        register(ToolResource.class);
    }
}
{% endhighlight %}

You can see that instead of simply supporting a GET request at `/tools/clean_games` I also added support for a query parameter that will allow me to override the maximum age of games that are retained on the server. I thought this would be handy in case someone spams the site and creates an obnoxious number of games. In that case I could simply pass in a value of "0" to clear out all games.

The resource will call into a new service named `GameTools` to do the real work and then respond with the number of games that were removed. Here's the implementation for `GameTools`:

**com/technicalrex/webapp/pegger/api/games/GameTools.java**

{% highlight java linenos %}
@Service
public class GameTools {
    private static final Logger LOGGER = Logger.getLogger(GameTools.class.getSimpleName());

    private static final long DEFAULT_MAX_AGE_IN_HOURS = 24 * 7;

    private final GameRepository gameRepository;

    @Inject
    public GameTools(GameRepository gameRepository) {
        this.gameRepository = Preconditions.checkNotNull(gameRepository);
    }

    public int removeOldGames() {
        return removeOldGames(DEFAULT_MAX_AGE_IN_HOURS);
    }

    public int removeOldGames(long maxAgeInHours) {
        Instant maxAgeTimestamp = Instant.now().minus(Duration.standardHours(maxAgeInHours));
        int totalGames = 0, gamesRemoved = 0;
        Iterable<Game> allGames = gameRepository.getAll();
        for (Game game : allGames) {
            totalGames++;
            if (game.getLastChangeTimestamp().isBefore(maxAgeTimestamp)) {
                Optional<Game> removedGame = gameRepository.deleteById(game.getGameId());
                if (removedGame.isPresent()) {
                    gamesRemoved++;
                }
            }
        }
        LOGGER.info(String.format("Removed %d games that were more than %d hours old.", gamesRemoved, maxAgeInHours));
        LOGGER.info(String.format("There are now %d active games.", totalGames - gamesRemoved));
        return gamesRemoved;
    }
}
{% endhighlight %}

As I filled in more of the gaps to implement this feature I discovered more changes that needed to be made. The first change is that there needed to be an additional repository method added to `GameRepository` to permanently delete a game. Fortunately this operation is pretty straight forward since our games are stored in a map:

**GameRepository.java**

{% highlight java linenos %}
public class GameRepository {
    // ...

    public Optional<Game> deleteById(UUID gameId) {
        return Optional.fromNullable(REPO.remove(gameId));
    }
}
{% endhighlight %}

The other change that I had to make was the default logging level for the tool. Initially, I had configured Java Logging to only log WARNING messages. For this tool it would be useful to see the output every time the resource is requested. In order to accomplish this I added a line to `logging.properties`:

**logging.properties**

{% highlight properties linenos %}
# Set the default logging level for all loggers to WARNING
.level = WARNING

# Tools run at INFO by default
GameTools.level = INFO
{% endhighlight %}

Voilà! Google App Engine will now make a GET request to `/tools/clean_games` every 12 hours and any games that haven't been changed in more than 7 days will be removed. We can also manually request this resource to force the task to do clean up. This imposes a problem though: I don't want just anyone to be able to delete games!

Fortunately Google allows users to be granted an "admin" role and this role is exposed to the Java servlet container so URLs can be restricted to this role. Not only that, but the task scheduler is automatically granted the "admin" role so it can continue to make requests to its configured resources without any further configuration in `cron.xml`.

**web.xml**

{% highlight xml linenos %}
<web-app>
    // ...

    <security-constraint>
        <web-resource-collection>
            <web-resource-name>tools</web-resource-name>
            <url-pattern>/tools/*</url-pattern>
        </web-resource-collection>
        <auth-constraint>
            <role-name>admin</role-name>
        </auth-constraint>
    </security-constraint>
</web-app>
{% endhighlight %}

What this really means is that we can make a small addition to `web.xml` and any resource starting with `/tools/` will be locked down such that only Pegger admins and the task scheduler can access them.

## Creating pegger.technicalrex.com

The last change I wanted to make to Pegger was the URL where people could go to play it. Ideally, it would appear to be hosted alongside this blog and easy to remember. I thought [pegger.technicalrex.com](http://pegger.technicalrex.com) would be perfect.

This turned out to be a two-step process:

1. Prove to Google that I own technicalrex.com.
2. Update my DNS settings to point pegger.technicalrex.com at Google's host.

These steps can be a little daunting if you're not familiar with domain management but there are excellent instructions provided by Google to [add a domain to your Google App account](https://support.google.com/a/answer/53295?hl=en). Of course, you need a Google App account and you need to be an admin in order to complete those instructions.

Right now, WordPress is managing my technicalrex.com domain. For whatever reason, I can not seem to find a way to navigate to my DNS settings from the Technical Rex blog's dashboard. I always end up poking around for 5-10 minutes before I give up and search the Internet for the location. If you have WordPress manage your domain then I'll save you the trouble. [WordPress domain management is located here.](https://wordpress.com/my-domains).

## The End

You've reached the end of the Pegger tutorial series, congratulations!

Thank you so much for reading this series, I really hope you have found it helpful. If you ever have any questions or comments, please don't hesitate to contact me.

Here are some suggestions for feedback:

1. If you want to request a feature or change to Pegger, [create an Issue on GitHub](https://github.com/egillespie/pegger/issues).
2. If you want to contact me privately, <a href="mailto:erik.gillespie@technicalrex.com">email me</a>.
3. If you want to ask general questions or provide feedback, comment on the most appropriate article in this [tutorial series]({{ "/tag/pegger/" | prepend: site.baseurl }}).

I will still be writing articles here too, so please stop by from time to time! Who knows, maybe I will start up a second Pegger series and talk about some more advanced topics. :)
