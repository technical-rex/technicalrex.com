---
layout: post
title: Pegger as a Component-Based API
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/09/15/pegger-as-a-component-based-api
excerpt: >
    Previously I implemented Pegger as a turn-based API using Java. After I finished the API I felt as if there were a few things about the implementation and overall data model that were a little clunky. The alternative API that we had discussed was a component-based API. Let's see how *that* looks as code.
---

[Previously]({{ site.baseurl }}{% post_url 2014-09-09-peggers-turn-based-api-in-java %}) I implemented Pegger as a [turn-based]({{ site.baseurl }}{% post_url 2014-09-02-designing-a-rest-api-for-a-turn-based-game %}) API using Java. After I finished the API I felt as if there were a few things about the implementation and overall data model that were a little clunky.

The *Board* seemed unnecessary. Accessing the pegs to validate and apply a turn required drilling down to the pegs by going through the board. This caused lots of object graph navigation. Since the board size can't change it also seemed silly to create an entity to hold those unchanging board dimensions.

Tracking the old and new positions of the last peg moved (i.e. the turn) ended up being unnecessary. After preventing a peg from moving back to its old location I realized that I only needed to store the ID and previous position of the last peg moved. This suggested that a turn in Pegger could be totally scrapped, which also meant my initial thought that a turn-based API would be ideal for Pegger might be wrong!

Validation also seemed more complicated than should be necessary. I think much of that complication came from reinterpreting turns as pegs. I also didn't have a separate repository for looking up pegs. This meant the code I wrote to find pegs could probably be moved into a common location.

This week I'm taking the time to clean some of this up. Since the last turn doesn't need to be tracked any more I am also going to refactor the whole API to use the component-based approach that I discussed previously.

Let's take a look at how well the code cleans up with these changes!

## Version Control, I Am Ready for You!

Before doing this big refactor it would be wise if I had a way to revert my changes in case I don't like them. For that reason, I have created a [Pegger GitHub repository](https://github.com/egillespie/pegger).

If you want to browse the turn-based API then click this [shortcut](https://github.com/egillespie/pegger/tree/2c68a679ccbc5c897f23adf51507d4c60405e984).

## Repackaging

Another change I'd like to make before refactoring the API is to repackage the project a little bit. One thing that bugged me by dumping basically all of the code in a single `games` package was that most of my classes started with *Game-* or *Turn-*. Normally I'm a fan of packaging by feature but I want to try moving the whole model into its own package to separate data holders from the game logic.

The result of this is that I created the package `com.technicalrex.webapp.pegger.model` and moved the `Game`, `Peg`, and `Position` classes there. (Actually I moved `Board` and `Turn` there too but they're going to be deleted soon so whatever.)

I moved everything else in `com.technicalrex.webapp.pegger.games` into `com.technicalrex.webapp.pegger.api.games`. I did this in anticipation of additional resources being added that sit beside the `/games` resource.

The last thing I did was to rename the `Status` class to `Reason` and nest it within `InvalidMoveException`, which itself was a rename of `InvalidTurnException`. I was never instantiating this class outside of the exception and was only passing strings to the constructor so it seemed to make sense to encapsulate everything in a single class.

## Cleaning Up *equals*, *hashCode*, and *toString*

Till now I haven't really mentioned that I'm using [IntelliJ IDEA](http://www.jetbrains.com/idea/) to develop this project. IntelliJ will generate `equals`, `hashCode`, and `toString` for you but I like [Guava](https://code.google.com/p/guava-libraries/)'s `Objects` and `MoreObjects` helper classes for filling in these methods. The Guava helpers have a much cleaner syntax and make adding new fields to `equals`/`hashCode`/`toString` very easy.

I bring this up because I noticed that some of my validation could have been avoided or simplified if I only used the unique identifiers for `Game` and `Peg` in the `equals` and `hashCode` methods. One such validation is the assurance that no two pegs in the game share the same identifier. By switching the list of pegs to a map and updating the `equals`/`hashCode` methods I can know that this situation will never happen.

Since I'm revisiting all of these methods I am going to use a hack that I discovered in IntelliJ to generate Guava versions of each of these methods for me using Velocity templates.

I will explain the hack in a future post but if you are curious, you can look at the [IntelliJ toString Velocity templates](https://github.com/berrysa/computerscience/tree/master/src/org/computerscience/egillespie/intellij/tostring) that I've written for this hack on GitHub.

## Refactoring the Model

Delete `Board` and `Turn`. Once that's done we only have three classes in our model: `Game`, `Peg`, and `Position`. Besides the `toString` refactor I mentioned in the previous section, `Position` doesn't change at all.

`Peg` doesn't change that much either. It simply needs to be annotated so Jackson can properly serialize and deserialize the entities into and out of JSON for us. The important parts look like this:

**Peg.java**

{% highlight java linenos %}
public class Peg {
    private final int pegId;
    private final Type type;
    private final Position position;

    @JsonCreator
    public Peg(@JsonProperty("pegId") int pegId,
               @JsonProperty("type") Type type,
               @JsonProperty("position") Position position) {
        this.pegId = Preconditions.checkNotNull(pegId);
        this.type = Preconditions.checkNotNull(type);
        this.position = Preconditions.checkNotNull(position);
    }

    // getters...

    public static enum Type {
        // static instances...

        @JsonCreator
        public static Type forName(String name) {
            if (FOR_NAME.containsKey(name)) {
                return FOR_NAME.get(name);
            }
            throw new IllegalArgumentException(String.format("Invalid peg name: %s", name));
        }

        // fields and constructor...

        @JsonValue
        public String getName() {
            return name;
        }

        // other getters...
    }
}
{% endhighlight %}

You'll see that I threw a `@JsonCreator` annotation on `Peg` and `Peg.Type`. I also put a `@JsonValue` annotation on `Peg.Type.getName()`.

There's one small bug fix here too. I added a precondition on `Peg.pegId` to make sure a non-null value is supplied.

The `Game` class had lots of changes though. It referenced both the `Board` and `Turn` classes so when they went away all of that code had to be updated. Here's what it looks like now.

**Game.java**

{% highlight java linenos %}
public class Game {
    public static final int ROWS = 2;
    public static final int COLUMNS = 4;

    private static final ImmutableSet<Peg> START_PEGS = ImmutableSet.<Peg>builder()
            .add(new Peg(1, Peg.Type.RED, new Position(1, 1)))
            .add(new Peg(2, Peg.Type.RED, new Position(2, 4)))
            .add(new Peg(3, Peg.Type.GREEN, new Position(1, 4)))
            .add(new Peg(4, Peg.Type.GREEN, new Position(2, 1)))
            .add(new Peg(5, Peg.Type.YELLOW, new Position(1, 2)))
            .add(new Peg(6, Peg.Type.YELLOW, new Position(2, 3)))
            .build();

    private static final Function<Peg, Integer> PEG_INDEXER = new Function<Peg, Integer>() {
        @Override
        public Integer apply(Peg peg) {
            return peg.getPegId();
        }
    };

    private final UUID gameId;
    private final Optional<Peg> lastPegMoved;
    private final ImmutableMap<Integer, Peg> pegs;
    private final boolean gameOver;

    private Game(UUID gameId, Peg lastPegMoved, ImmutableSet<Peg> pegs) {
        this.gameId = Preconditions.checkNotNull(gameId);
        this.lastPegMoved = Optional.fromNullable(lastPegMoved);
        this.pegs = Maps.uniqueIndex(Preconditions.checkNotNull(pegs), PEG_INDEXER);
        this.gameOver = calculateGameOver();
        validateGameState();
    }

    public static Game start(UUID gameId) {
        return new Game(gameId, null, START_PEGS);
    }

    public Game movePeg(Peg pegWithNewPosition) {
        Peg pegWithOldPosition = null;
        ImmutableSet.Builder<Peg> pegBuilder = ImmutableSet.builder();
        for (Peg peg : getPegs()) {
            if (peg.getPegId() == pegWithNewPosition.getPegId()) {
                pegBuilder.add(pegWithNewPosition);
                pegWithOldPosition = peg;
            } else {
                pegBuilder.add(peg);
            }
        }
        if (pegWithOldPosition == null) {
            throw new IllegalStateException(String.format("Peg %d does not exist.", pegWithNewPosition.getPegId()));
        }
        return new Game(gameId, pegWithOldPosition, pegBuilder.build());
    }

    public UUID getGameId() {
        return gameId;
    }

    public Optional<Peg> getLastPegMoved() {
        return lastPegMoved;
    }

    public ImmutableCollection<Peg> getPegs() {
        return pegs.values();
    }

    public Optional<Peg> getPeg(int pegId) {
        return Optional.fromNullable(pegs.get(pegId));
    }

    public boolean isGameOver() {
        return gameOver;
    }

    private boolean calculateGameOver() {
        Iterable<Peg> allPegs = getPegs();
        for (Peg peg : allPegs) {
            if (peg.getType().isNeutral()) {
                continue;
            }
            for (Peg testPeg : allPegs) {
                if (peg.getPegId() != testPeg.getPegId() && peg.getType() == testPeg.getType()
                        && (peg.getPosition().isAdjacentTo(testPeg.getPosition()))) {
                    return true;
                }
            }
        }
        return false;
    }

    private void validateGameState() {
        Preconditions.checkArgument(pegs.size() == 6, "Exactly six pegs are required.");
        Iterable<Peg> allPegs = getPegs();
        for (Peg peg : allPegs) {
            Position position = peg.getPosition();
            if (position.getRow() < 1 || position.getRow() > ROWS) {
                throw new IllegalStateException(String.format("Peg %d is at an invalid row on the board.", peg.getPegId()));
            } else if (position.getColumn() < 1 || position.getColumn() > COLUMNS) {
                throw new IllegalStateException(String.format("Peg %d is at an invalid column on the board.", peg.getPegId()));
            }

            int positionCount = 0;
            for (Peg otherPeg : allPegs) {
                if (peg.getPosition().equals(otherPeg.getPosition())) {
                    positionCount++;
                }
            }
            if (positionCount != 1) {
                throw new IllegalStateException("All pegs on a board must be at different positions.");
            }
        }
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (o == null || getClass() != o.getClass()) {
            return false;
        }
        Game that = (Game) o;
        return Objects.equal(this.gameId, that.gameId);
    }

    @Override
    public int hashCode() {
        return Objects.hashCode(gameId);
    }

    @Override
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("gameId", gameId)
                .add("lastPegMoved", lastPegMoved)
                .add("gameOver", gameOver)
                .add("pegs", pegs)
                .toString();
    }
}
{% endhighlight %}

I moved much of the board logic directly into the game and replaced `lastTurn` with `lastPegMoved`. I also calculate `gameOver` upon construction to reduce the CPU required if a game is retrieved many times in a row.

## Adding the Peg Resource

Eventually I'll have to figure out the logic that needs to change in `GameOperator` to facilitate making Pegger a component-based API instead of a turn-based API. To get us to the point where those changes become clear, let's stub out what the `PegResource` would would look like.

Recall from my an earlier article that in a component-based Pegger game we would need only to support a `PUT /games/{gameId}/pegs/{pegId}` resource to manage turn-taking by moving components.

**PegResource.java**

{% highlight java linenos %}
@Path("/games/{gameId}/pegs")
@Produces(MediaType.APPLICATION_JSON)
public class PegResource {
    private final GameOperator gameOperator;

    @Inject
    public PegResource(GameOperator gameOperator) {
        this.gameOperator = Preconditions.checkNotNull(gameOperator);
    }

    @PUT
    @Path("/{pegId}")
    @Consumes(MediaType.APPLICATION_JSON)
    public Response updatePeg(@Context UriInfo uriInfo,
                              @PathParam("gameId") UUID gameId,
                              @PathParam("pegId") int pegId,
                              Peg peg) {
        Game game = gameOperator.lookForGame(gameId).orNull();
        if (game == null) {
            return Responses.NOT_FOUND;
        } else if (peg == null) {
            return Responses.BAD_REQUEST;
        } else if (pegId != peg.getPegId()) {
            return Responses.CONFLICT;
        }
        try {
            gameOperator.movePeg(game, peg);
            URI location = uriInfo.getBaseUriBuilder()
                               .path("games").path("{gameId}")
                               .build(game.getGameId());
            return Response
                   .status(Response.Status.SEE_OTHER)
                   .location(location)
                   .build();
        } catch (InvalidMoveException e) {
            return Response
                   .status(Response.Status.FORBIDDEN)
                   .entity(e.getReason())
                   .build();
        }
    }
}
{% endhighlight %}

The logic here is a bit more lengthy than anything in `GameResource` but overall it's pretty straight forward. Besides a few sanity checks that need to be made up front it's very similar to the `POST /turns` resource in the original API. So far it seems that the main difference is a semantic one: we're restating "take a turn" as "move a peg".

Let's go ahead and stub out the `GameOperator.movePeg` method to see what it might look like.

**GameOperator.java**

{% highlight java linenos %}
public class GameOperator
    // other methods...

    public Game movePeg(Game game, Peg pegWithNewPosition) {
        validateMove(game, pegWithNewPosition);
        Game newGame = game.movePeg(pegWithNewPosition);
        gameRepository.update(newGame);
        return newGame;
    }
}
{% endhighlight %}

The steps are almost methodical now:

1. Validate the move.
2. Move the peg.
3. Persist the new game state.
4. Return the new game state.

All of the validation has been moved into its own method, moving the peg is facilitated by a method on the game itself (this method used to exist on the `Board` class), and everything else is the same.

## Simplifying Validation

There are a handful of other small changes that have been made to Pegger but none have them have much substance to them besides the changes to validation. The previous section showed that all of the validation was consolidated down into a single method. That means we should be doing more validation now, right?

Nope! Because of how we have reorganized the model there is actually *less* validation since we simply can't get ourselves into certain sticky situations. Finding the peg that needs to be checked has also been simplified now that we're thinking in terms of pegs instead of turns too through the introduction of `PegRepository`.

Here's what the validation looks like now:

**GameOperator.java**

{% highlight java linenos %}
public class GameOperator {
    // other methods...

    private void validateMove(Game game, Peg pegWithNewPosition) {
        if (game.isGameOver()) {
            throw new InvalidMoveException("The game is over. No additional pegs may be moved.");
        }

        Peg pegWithOldPosition = pegRepository.getById(game.getGameId(), pegWithNewPosition.getPegId()).orNull();
        if (pegWithOldPosition == null) {
            throw new InvalidMoveException(String.format("Peg %d does not exist.", pegWithNewPosition.getPegId()));
        } else if (pegWithOldPosition.getType() != pegWithNewPosition.getType()) {
            throw new InvalidMoveException("Peg type cannot be changed.");
        }

        Position toPosition = pegWithNewPosition.getPosition();
        if (toPosition.getColumn() < 1 || toPosition.getColumn() > Game.COLUMNS) {
            throw new InvalidMoveException("Peg cannot be moved to that column.");
        } else if (toPosition.getRow() < 1 || toPosition.getRow() > Game.ROWS) {
            throw new InvalidMoveException("Peg cannot be moved to that row.");
        } else if (toPosition.equals(pegWithOldPosition.getPosition())) {
            throw new InvalidMoveException("The peg must be moved.");
        }

        for (Peg peg : game.getPegs()) {
            if (toPosition.equals(peg.getPosition())) {
                throw new InvalidMoveException("Another peg is in that position.");
            }
        }

        if (game.getLastPegMoved().isPresent()) {
            Peg lastPegMoved = game.getLastPegMoved().get();
            if (lastPegMoved.getPegId() == pegWithNewPosition.getPegId() && lastPegMoved.getPosition().equals(toPosition)) {
                throw new InvalidMoveException("This peg cannot be returned to its previous location.");
            }
        }
    }
}
{% endhighlight %}

And here's the handy in-memory `PegRepository`:

**PegRepository.java**

{% highlight java linenos %}
@Repository
public class PegRepository {
    private final GameRepository gameRepository;

    @Inject
    public PegRepository(GameRepository gameRepository) {
        this.gameRepository = Preconditions.checkNotNull(gameRepository);
    }

    public Optional<Peg> getById(UUID gameId, int pegId) {
        Game game = gameRepository.getById(gameId).orNull();
        return game == null ? Optional.<Peg>absent() : game.getPeg(pegId);
    }
}
{% endhighlight %}

By making the pegs on our game a map we not only eliminated the possibility of two pegs with the same ID from being used in a game, we also made it very quick and easy to look up individual pegs within a game.

## Final Thoughts

I'm pleasantly surprised to report that even in as simple of a game as Pegger, the component-based API has a couple of benefits over an equivalent turn-based API. We saw both the model for the game and the validation became even simpler. As I develop more games I am going to use a component-base API even if it seems that a turn-based API may fit the game better.

We still have a lot to explore with Pegger's implementation. I would like to swap out the hot-seat version of the game for something that allows two users on two different computers to go head-to-head. I need to persist the games in some sort of database. I also need to slap a UI on this game because sheesh, playing the game in Postman is pretty rough.

I'll leave it at that. You'll just have to come back next week to see what's next!
