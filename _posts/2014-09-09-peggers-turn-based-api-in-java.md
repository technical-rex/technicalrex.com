---
layout: post
title: Pegger's Turn-Based API in Java
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/09/09/peggers-turn-based-api-in-java
excerpt: >
    At the end of my last article I came to the conclusion that a turn-based API would probably best suit the game Pegger. This week I decided to implement that API in Java to see how everything would unfold. Let's see how the turn-based API ended up looking as code.
---

At the end of my [last article]({{ site.baseurl }}{% post_url 2014-09-02-designing-a-rest-api-for-a-turn-based-game %}) I came to the conclusion that a turn-based API would probably best suit the game Pegger. This week I decided to implement that API in Java to see how everything would unfold.

## Design and Coding Conventions

Before I dive into the code let me state some of the design choices and coding conventions that I have chosen:

1. **Use Immutable Entities**. The idea of being able to save a snapshot of the game state before or after each turn is pretty appealing and while I won't be implementing that feature right now, I decided to create immutable entities to make it easier to do so in the future.
2. **Save Games In Memory**. I will create an in-memory repository for tracking games so I won't have to worry about a database in the first iteration of the API.
3. **Leave Out Players**... for now. I'm taking the concept of the "player" out of the implementation so I can focus on the API behind taking turns. The first iteration of the API will effectively be a hot-seat API where two people take turns at a single computer and trust each other to only take one turn at a time.
4. **Don't Embed the Game in the Turn**. I have started reading *[RESTful Web APIs](http://restfulwebapis.com)* and at page 9 I had the idea to return a 303 (See Other) response after creating a turn while providing the Location of the parent game resource. This will cause an extra HTTP request but should simplify the data model.
5. **Use Guava**. [Guava](https://code.google.com/p/guava-libraries/) provides a whole swath of libraries that make building immutable entities in Java a cinch. Google rolls their own Optional too, which is useful since I won't be using Java 8 for Pegger.
6. **Crank It Out**. I'm not going for pretty code, just something that adheres to the above principles and gets the job done. If you're looking for unit tests you'll have to sit tight. I'm also coupling the code to Spring by using stereotype annotations for registering and autowiring dependencies.

## Create the Entities

Now that I have some general coding guidelines it's time to start implementing the entities that will reflect the [game model]({{ site.baseurl }}{% post_url 2014-08-26-modeling-a-turn-based-game-with-json %}) that I'm aiming for.

Pegger will require a *Game* entity that contains a representation of the last *Turn* and the state of the *Board*. The Board will have a set of *Peg*s which will each have a *Position*. To satisfy the entities' dependencies on other entities, I wrote these classes in reverse order.

For each entity I have only included the bare minimum amount of code to demonstrate how I'm enforcing immutability and handling JSON serialization/deserialization using Jackson annotations. Assume that each class within this section has a getter for each field as well as `equals`, `hashCode`, and `toString` methods.

I will be putting this code up on GitHub soon too so if you have trouble following along just keep your eyes peeled for a link to the complete source code.

**Position.java**

{% highlight java linenos %}
public class Position {
    private final int row;
    private final int column;

    @JsonCreator
    public Position(@JsonProperty("row") int row,
                    @JsonProperty("column") int column) {
        this.row = row;
        this.column = column;
    }

    public boolean isAdjacentTo(Position position) {
        if (row == position.row) {
            return column == position.column - 1
                || column == position.column + 1;
        } else if (column == position.column) {
            return row == position.row - 1
                || row == position.row + 1;
        }
        return false;
    }

    // ...
}
{% endhighlight %}

The `isAdjacentTo` method on *Position* is a convenience method we will need in order to determine if victory has been achieved in the game. More on that below.

**Peg.java**

{% highlight java linenos %}
public class Peg {
    private final int pegId;
    private final Type type;
    private final Position position;

    public Peg(int pegId, Type type, Position position) {
        this.pegId = pegId;
        this.type = Preconditions.checkNotNull(type);
        this.position = Preconditions.checkNotNull(position);
    }

    public static enum Type {
        RED("red", false),
        GREEN("green", false),
        YELLOW("yellow", true);

        private static final ImmutableMap<String, Type> FOR_NAME;

        static {
            final ImmutableMap.Builder<String, Type> FOR_NAME_BUILDER
                = ImmutableMap.builder();
            for (Type type : Type.values()) {
                FOR_NAME_BUILDER.put(type.getName(), type);
            }
            FOR_NAME = FOR_NAME_BUILDER.build();
        }

        @JsonCreator
        public static Type forName(@JsonProperty("type") String name) {
            if (FOR_NAME.containsKey(name)) {
                return FOR_NAME.get(name);
            }
            throw new IllegalArgumentException(
                String.format("Invalid peg name: %s", name));
        }

        private final String name;
        private final boolean neutral;

        Type(String name, boolean neutral) {
            this.name = name;
            this.neutral = neutral;
        }

        @JsonValue
        public String getName() {
            return name;
        }

        // ...
    }

    // ...
}
{% endhighlight %}

The *Peg Type* defines the three types of pegs in Pegger: red and green (valid victory-condition pegs) and yellow neutral pegs. It takes a lot of code in Java to serialize and deserialize enums using custom names.

**Board.java**

{% highlight java linenos %}
public class Board {
    public static Board START = new Board(
            new Peg(1, Peg.Type.RED, new Position(1, 1)),
            new Peg(2, Peg.Type.RED, new Position(2, 4)),
            new Peg(3, Peg.Type.GREEN, new Position(1, 4)),
            new Peg(4, Peg.Type.GREEN, new Position(2, 1)),
            new Peg(5, Peg.Type.YELLOW, new Position(1, 2)),
            new Peg(6, Peg.Type.YELLOW, new Position(2, 3)));

    private final int rows = 2;
    private final int columns = 4;
    private final ImmutableList<Peg> pegs;

    private Board(Peg... pegs) {
        this(ImmutableList.copyOf(Preconditions.checkNotNull(pegs)));
    }

    private Board(ImmutableList<Peg> pegs) {
        this.pegs = pegs;
        validatePegs();
    }

    public Board movePeg(int pegId, Position toPosition) {
        ImmutableList.Builder<Peg> builder = ImmutableList.builder();
        for (Peg peg : pegs) {
            if (peg.getPegId() == pegId) {
                builder.add(new Peg(pegId, peg.getType(), toPosition));
            } else {
                builder.add(peg);
            }
        }
        return new Board(builder.build());
    }

    private void validatePegs() {
        for (Peg peg : pegs) {
            Position position = peg.getPosition();
            if (position.getRow() < 1 || position.getRow() > rows) {
                throw new IllegalStateException(String.format("Peg %d is at an invalid row on the board.", peg.getPegId()));
            }
            if (position.getColumn() < 1 || position.getColumn() > columns) {
                throw new IllegalStateException(String.format("Peg %d is at an invalid column on the board.", peg.getPegId()));
            }

            int pegIdCount = 0;
            int positionCount = 0;
            for (Peg otherPeg : pegs) {
                if (peg.getPegId() == otherPeg.getPegId()) {
                    pegIdCount++;
                }
                if (peg.getPosition().equals(otherPeg.getPosition())) {
                    positionCount++;
                }
            }
            if (pegIdCount != 1) {
                throw new IllegalStateException("All peg identifiers on a board must be unique.");
            }
            if (positionCount != 1) {
                throw new IllegalStateException("All pegs on a board must be at different positions.");
            }
        }
    }

    // ...
}
{% endhighlight %}

The *Board* makes sure that it is constructed in a valid state and throws an `IllegalStateException` (probably not the most appropriate exception but the name sort of fits). if a peg is placed somewhere incorrectly in the hard-coded 2x4 board.

The `movePeg` method is a convenience method for constructing a new *Board* instance with a *Peg* moved to a new location.

There is also a static instance of the starting *Board* configuration that will be handing when creating new games (an added perk of using immutable entities).

**Turn.java**

{% highlight java linenos %}
public class Turn {
    private final int pegId;
    private final Position fromPosition;
    private final Position toPosition;

    @JsonCreator
    public Turn(@JsonProperty("pegId") int pegId,
                @JsonProperty("fromPosition") Position fromPosition,
                @JsonProperty("toPosition") Position toPosition) {
        this.pegId = pegId;
        this.fromPosition = Preconditions.checkNotNull(fromPosition);
        this.toPosition = Preconditions.checkNotNull(toPosition);
    }

    // ...
}
{% endhighlight %}

**Game.java**

{% highlight java linenos %}
public class Game {
    private final UUID gameId;
    private final Optional<Turn> lastTurn;
    private final Board board;

    public Game(UUID gameId, Board board) {
        this(gameId, null, board);
    }

    public Game(UUID gameId, Turn lastTurn, Board board) {
        this.gameId = gameId;
        this.lastTurn = Optional.fromNullable(lastTurn);
        this.board = Preconditions.checkNotNull(board);
    }

    public boolean isGameOver() {
        for (Peg peg : board.getPegs()) {
            if (peg.getType().isNeutral()) {
                continue;
            }
            for (Peg testPeg : board.getPegs()) {
                if (peg.getPegId() != testPeg.getPegId()
                    && peg.getType() == testPeg.getType()
                    && (peg.getPosition().isAdjacentTo(testPeg.getPosition()))) {
                    return true;
                }
            }
        }
        return false;
    }

    // ...
}
{% endhighlight %}

You'll see on the *Game* entity I added an `isGameOver` method to identify whether victory has been achieved given the current configuration of pegs on the board. This method will get serialized to JSON. It also required that I add an `isAdjacentTo` method on *Position*.

I also switched the type for the *Game*'s `gameId` field from a number to a string. This is because I have no database-driven sequence to control the generation of this value so I picked random UUIDs presented as strings to manage uniqueness of this field.

## Stub Out the API

After creating entities that match the model that was designed I implemented the resources that would be needed. Going the turn-based API route, the following would be needed:

1. `POST /games` - Create a new game.
2. `GET /games/{gameId}` - Get the current state of a created game.
3. `POST /games/{gameId}/turns` - Apply a new turn to the game.

Splitting this functionality up led to two classes: GameResource and TurnResource.

**GameResource.java**

{% highlight java linenos %}
@Path("/games")
@Produces(MediaType.APPLICATION_JSON)
public class GameResource {
    private final GameOperator gameOperator;

    @Inject
    public GameResource(GameOperator gameOperator) {
        this.gameOperator = Preconditions.checkNotNull(gameOperator);
    }

    @POST
    public Response newGame(@Context UriInfo uriInfo) {
        Game game = gameOperator.startGame();
        URI location = uriInfo.getAbsolutePathBuilder().path("{arg1}").build(game.getGameId());
        return Response.created(location).entity(game).build();
    }

    @GET
    @Path("/{gameId}")
    public Response getGame(@PathParam("gameId") UUID gameId) {
        Optional<Game> gameResult = gameOperator.lookForGame(gameId);
        if (!gameResult.isPresent()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        return Response.ok(gameResult.get()).build();
    }
}
{% endhighlight %}

Creating a new game currently does not require any input. Simply POSTing to `/games` will create a new game and make it accessible at `/games/{gameId}`. This location is returned in the Location header of the response and we send back a status of 201 (Created). As a nicety I also send the game state back in the response body so the client does not have to perform an immediate GET to retrieve the state of the newly created game.

A request to retrieve a specific game can yield one of two results: the game is found or it isn't. If the game is found then we will return it in the response body with an HTTP status of 200 (Okay). If the game is not found then a 404 (Not Found) status with no body is sufficient.

**TurnResource.java**

{% highlight java linenos %}
@Path("/games/{gameId}/turns")
@Produces(MediaType.APPLICATION_JSON)
public class TurnResource {
    private final GameOperator gameOperator;

    @Inject
    public TurnResource(GameOperator gameOperator) {
        this.gameOperator = Preconditions.checkNotNull(gameOperator);
    }

    @POST
    @Consumes(MediaType.APPLICATION_JSON)
    public Response newTurn(@Context UriInfo uriInfo, @PathParam("gameId") UUID gameId, Turn turn) {
        Optional<Game> gameResult = gameOperator.lookForGame(gameId);
        if (!gameResult.isPresent()) {
            return Response.status(Response.Status.NOT_FOUND).build();
        }
        try {
            Game game = gameOperator.playTurn(gameResult.get(), turn);
            URI location = uriInfo.getBaseUriBuilder().path("games").path("{gameId}").build(game.getGameId());
            return Response.status(Response.Status.SEE_OTHER).location(location).build();
        } catch (InvalidTurnException e) {
            return Response.status(Response.Status.FORBIDDEN).entity(e.getStatus()).build();
        }
    }
}
{% endhighlight %}

Adding a turn to a game is a bit more complicated than creating or retrieving a game. First, we ensure that the game exists by looking it up and if not, we respond with a 404 (Not Found) status.

If the game is found then we can attempt to apply the turn. However, since we are accepting a *Turn* as a payload from an untrusted source that we will need to ensure that the turn is valid before updating the game to reflect the turn. I addressed this by assuming an `InvalidTurnException` would be thrown in the event of a bogus turn being played. More detail about the reason that the turn was rejected would be supplied in the status of the exception.

When the turn is played successfully the method will return a 303 (See Other) status and the Location of the parent game to suggest to the client that the game state has changed.

If a bad turn is played then a status code of 403 (Forbidden) and a message explaining the reason will be returned to the client.

Here's what the `InvalidTurnException` and `Status` classes look like:

**Status.java**

{% highlight java linenos %}
public class Status {
    private final String message;

    public Status(String message) {
        this.message = Preconditions.checkNotNull(message);
    }

    public String getMessage() {
        return message;
    }
}
{% endhighlight %}

**InvalidTurnException.java**

{% highlight java linenos %}
public class InvalidTurnException extends RuntimeException {
    private final Status status;

    public InvalidTurnException(String message) {
        this(new Status(message));
    }

    public InvalidTurnException(Status status) {
        super(status.getMessage());
        this.status = status;
    }

    public Status getStatus() {
        return status;
    }
}
{% endhighlight %}

## Storing the Games

Before getting to the fun part I wanted to quickly point out how I would be storing games for the first iteration of Pegger. For now all games are stored in memory in a map that associates the game ID with the current game state.

This means that Pegger won't really work in a clustered environment. It also means that we don't have any history of the various turns of the game (which isn't a big deal, but it might be a fun feature to implement in the future).

Since our *Game* entity is immutable it also means that we need to be able to replace a game in the map with a new instance once a turn is applied. To cover our use cases of creating a game, adding turns, and retrieving the state of the game this means the repository needs save, update, and find methods.

**GameRepository.java**

{% highlight java linenos %}
@Repository
public class GameRepository {
    private static final Map<UUID, Game> REPO = Maps.newConcurrentMap();

    public UUID nextId() {
        return UUID.randomUUID();
    }

    public void save(Game game) {
        if (REPO.containsKey(game.getGameId())) {
            throw new UnsupportedOperationException(String.format("Game with ID %s already exists.", game.getGameId()));
        }
        REPO.put(game.getGameId(), game);
    }

    public void update(Game game) {
        if (!REPO.containsKey(game.getGameId())) {
            throw new UnsupportedOperationException(String.format("Game with ID %s does not exist.", game.getGameId()));
        }
        REPO.put(game.getGameId(), game);
    }

    public Optional<Game> getById(UUID gameId) {
        return Optional.fromNullable(REPO.get(gameId));
    }
}
{% endhighlight %}

## Finally, the Game Logic!

Everything up to this point has been pretty boring code. When creating a game the two fun parts are the UI and the game logic. Since we're not quite ready to implement a UI, we can at least be satisfied that we're finally writing the meat of our game.

Instead of creating a service class that has plain-sounding create, update, and retrieve methods, I decided to treat this class as a moderator of all game operations and gave them names more befitting our turn-based game domain.

**GameOperator.java**

{% highlight java linenos %}
@Service
public class GameOperator {
    private final GameRepository gameRepository;

    @Inject
    public GameOperator(GameRepository gameRepository) {
        this.gameRepository = Preconditions.checkNotNull(gameRepository);
    }

    public Game startGame() {
        Game game = new Game(gameRepository.nextId(), Board.START);
        gameRepository.save(game);
        return game;
    }

    public Optional<Game> lookForGame(UUID gameId) {
        return gameRepository.getById(gameId);
    }

    public Game playTurn(Game game, Turn turn) {
        if (game.isGameOver()) {
            throw new InvalidTurnException("The game is over. No additional turns may be played.");
        }
        validateTurn(game, turn);
        Game newGame = movePeg(game, turn);
        gameRepository.update(newGame);
        return newGame;
    }

    private void validateTurn(Game game, Turn turn) {
        Position toPosition = turn.getToPosition();
        if (toPosition.getColumn() < 1 || toPosition.getColumn() > game.getBoard().getColumns()) {
            throw new InvalidTurnException("Peg cannot be moved to that column.");
        }
        if (toPosition.getRow() < 1 || toPosition.getRow() > game.getBoard().getRows()) {
            throw new InvalidTurnException("Peg cannot be moved to that row.");
        }
        if (toPosition.equals(turn.getFromPosition())) {
            throw new InvalidTurnException("The peg must be moved.");
        }

        Peg movingPeg = null;
        for (Peg peg : game.getBoard().getPegs()) {
            if (turn.getToPosition().equals(peg.getPosition())) {
                throw new InvalidTurnException("Another peg is in that position.");
            }

            if (peg.getPegId() == turn.getPegId()) {
                movingPeg = peg;
            }
        }

        if (movingPeg == null) {
            throw new InvalidTurnException(String.format("Peg %d does not exist.", turn.getPegId()));
        }
        if (!movingPeg.getPosition().equals(turn.getFromPosition())) {
            throw new InvalidTurnException(String.format("Peg %d does not exist at that position.", turn.getPegId()));
        }

        if (game.getLastTurn().isPresent()) {
            Turn lastTurn = game.getLastTurn().get();
            if (lastTurn.getPegId() == turn.getPegId() && lastTurn.getFromPosition().equals(turn.getToPosition())) {
                throw new InvalidTurnException("The previous turn cannot be undone.");
            }
        }
    }

    private Game movePeg(Game game, Turn turn) {
        return new Game(game.getGameId(), turn, game.getBoard().movePeg(turn.getPegId(), turn.getToPosition()));
    }
}
{% endhighlight %}

Starting a new game and looking for a specific game are pretty straight forward and hardly worth discussion.

Playing a turn has some heft to it though. Before doing anything with a turn we first check if the game is already over. If it is, we throw an `InvalidTurnException` stating as much. Next we check if one of a variety of bad turns is being applied and call the user out with a specific reason explaining why their turn doesn't count. It's probably much more efficient to look at the small number of valid turns but then we would not be able to supply anything more than a generic "Invalid Turn" message that would probably lead to a bad user experience.

Once we've verified that the turn is valid then we can lookup the appropriate peg on the game board and move it to its new location and then update the game in the in-memory repository.

## Testing It Out

With all of the pieces in place I installed the app and ran my local App Engine server with a couple of Maven commands:

{% highlight bash %}
$ cd ~/projects/pegger
$ mvn clean install
$ cd pegger-ear
$ mvn appengine:devserver
{% endhighlight %}

With the server running I launched [Postman](http://www.getpostman.com/) from within Chrome and created a collection named "Pegger". Then I added the three requests that needed to be tested and sent them away.

I could have saved some time troubleshooting issues by writing unit tests. Most of the issues I found revolved around the validation of turns and trying to set up an invalid turn, test it, fix it, and redeploy was time consuming.

Eventually the kinks were all worked out though and I had a nice hot-seat game of Pegger that could be played via Postman.

## Final Thoughts

After writing the code there were a few things that I discovered I liked and a few things that I didn't like about the implementation and design choices.

I like the potential that using immutable entities offers, but wow did it make changing the state of the game cumbersome! Instead of simply being able to call `game.getBoard().getPeg(pegId).setPosition(row, column)` I had to litter the code with convenience methods to make it easier to clone pieces of game state and piece them back together. I don't regret the decision to go the immutable route but it sure does seem like I spent more time reconstructing objects during this exercise than was worthwhile.

Responding with a 303 (See Other) after a turn is successfully applied worked out really well. Postman automatically issued the second request and retrieved the game so the process of playing a turn and getting the new state of the game was pretty seamless.

The final piece that seemed out of place was the game board. From a design perspective it seemed to be a natural way to organize the game data but in hindsight it seems that there is no reason I couldn't have just managed all of the pegs directly within the game. It would have avoided yet another object that had to be cloned when the game state changed. There also didn't seem to be much point in having a customizable board size so I ended up hard-coding the values. Validation perhaps could have been simplified if I didn't code to the size of the board as if it could be anything other than 2x4.

So there's the first iteration of Pegger. It works and it didn't take long to implement. Next up I think I may take some of what I learned about the model and apply that to the component-based API.

Stay tuned!
