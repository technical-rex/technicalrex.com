---
layout: post
title: Designing a REST API for a Turn-Based Game
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/09/02/designing-a-rest-api-for-a-turn-based-game
excerpt: >
    Previously, we created a JSON model for Pegger. Now it's time to come up with an API that HTTP clients can use to interact with our game. In this tutorial we'll be designing an API "on paper". No coding for, just thinking things through.
---

Previously, we created a [JSON model]({{ site.baseurl }}{% post_url 2014-08-26-modeling-a-turn-based-game-with-json %}) for Pegger. Now it's time to come up with an API that HTTP clients can use to interact with our game.

First, let's consider two of the basic facets of turn-based games:

1. They are typically constructed from a set of components such as dice, cards, tokens, pegs, and so on.
2. Gameplay is divided into turns that allow players to manipulate those components.

Behind this general game structure we can arrive at two possible ways to think about an API. The API can be built around turns that contain all of the actions a player has taken or we can think of the API as a means to manipulate the various components of the game and completing turns as we go.

In other words, we can try to create an API that is turn-based or we can craft an API that is component-based.

**Edit:** I have received feedback about my use of the term "REST" and the broader REST community seems to agree that the term has become conflated. One of the fundamental aspects of REST that I have been overlooking is the use of hypermedia. Since I am not intending to use hypermedia (yet) for Pegger, I think it is better that I start referring to my API as HTTP instead of REST to avoid confusion and unrest. Within this article please assume that any time I use the term REST I effectively mean REST-sans-hypermedia (which isn't REST at all!) or just plain HTTP.

## Game State Revisited

Thinking of these APIs as HTTP endpoints, both of these approaches share a common root: `/games/{gameId}`. Beneath the game resource is where the two techniques diverge and their respective strengths and weaknesses become apparent.

Before we explore each approach in more depth, let's review a snippet of the JSON model that was developed in the [previous article]({{ site.baseurl }}{% post_url 2014-08-26-modeling-a-turn-based-game-with-json %}). We should be able to use this model regardless of which API technique is chosen.

{% highlight js %}
{
    "gameId": 8623847623,
    "player1": 12345,
    "player2": 67890,
    "currentPlayer": "player2",
    "lastTurn": {
        "takenByPlayer": "player1",
        "pegId": 1,
        "fromPosition": {
            "row": 1,
            "column": 1
        },
        "toPosition": {
            "row": 1,
            "column": 3
        }
    },
    "board": {
        "rows": 2,
        "columns": 4,
        "pegs": [
            {
                "pegId": 1,
                "type": "red",
                "position": {
                    "row": 1,
                    "column": 3
                }
            },
            ...
        ]
    }
}
{% endhighlight %}

## Turn-Based API

A turn-based API would have an endpoint such as `/games/{gameId}/turns` to which a player could POST a representation of their turn. For Pegger that representation would look like the `lastTurn` attribute of our game model.

Using this approach, all of the information needed to complete a player's turn is supplied in the request body. This is not unlike play-by-mail games of the not-too-distant past. In play-by-mail, both players start with a copy of the game being played. When a player finishes their turn they mail their opponent a letter containing just the details about their turn. When their opponent receives the letter that turn is applied to their own copy of the game. The opponent then takes their turn and the process repeats until the conditions for victory are met. This system allows the game to be kept in sync across players without each player needing a complete snapshot of the game after each turn is taken.

Play-by-mail works very well for two-player games with simple turn structures, no randomized components (such as dice), and no secret components (such as a hand of cards). The play-by-mail system becomes very cumbersome and problematic when any of these constraints are violated. The turn-based approach to designing an API shares many of these pros and cons.

Consider the card game [UNO](http://en.wikipedia.org/wiki/Uno_(card_game)). Up to ten people may play the game but before the game begins a turn order must be established. The turn order can change over the course of a game and players may also be skipped. A player's cards are kept hidden from all other players too, so certain information about a player's turn (such as a recently drawn card) cannot be shared with the other players. That element of hidden game state between players introduces somewhat of a paradox though. How do you prevent cheating while keeping all players' games in sync if players are not allowed to know certain details about their opponents and of the game in general?

Fortunately our API will reside on a central server so these play-by-mail issues are nothing but technical constraints to us but they do affect the API and its underlying implementation. Some sort of user/player verification needs to exist in order to keep information hidden from players. Rolling a die or retrieving a card from a shuffled deck may require multiple requests to the server since the result of such an action may affect the current turn. Also, turn-order changes need to be seen by all players, not just the next player in turn order, so the API must coordinate with each player about the common game information as well as details specific to each player.

Fortunately coordinating game state on a central server allows us to work around many of the play-by-mail limitations. However, there are some additional considerations that need to be kept in mind when using a turn-based API:

1. Turn structure needs to be well-defined. This becomes more difficult as game complexity increases.
2. Multi-action turns may require more endpoints than just `/games/{gameId}/turns`. For example, a turn may be broken up into actions and represented as `/games/{gameId}/turns/{turnId}/actions`.
3. Client presentation of turns may be difficult since a turn happens all at once. The finer details of how components were affected by a turn may not be clear to other players who just see the entire game state change.

Furthermore, after a turn is taken it would be useful if the new game state appeared in the response. This is primarily a helpful efficiency to avoid a subsequent GET of the game state after performing a POST to `/games/{gameId}/turns`. Responding with only the new game state seems awkward though. To get the best of both worlds, let's embed the game state as a `parent` attribute of the new turn. The example below is abbreviated to make it easier to read.

{% highlight js %}
{
    "takenByPlayer": "player1",
    "pegId": 1,
    "fromPosition": {
        "row": 1,
        "column": 1
    },
    "toPosition": {
        "row": 1,
        "column": 3
    },
    "parent": {
        "gameId": 8623847623,
        "player1": 12345,
        "player2": 67890,
        "currentPlayer": "player2",
        ...
    }
}
{% endhighlight %}

Using a turn-based API would work well for simple, strategic 2-player games. For Pegger it looks like at a minimum the following resources would be required:

1. `GET /games/{gameId}`
2. `POST /games/{gameId}/turns`

If we wanted to show a history of the turns we could also implement `GET /games/{gameId}/turns` and that certainly would be a useful feature in a strategy game.

But how does this compare to a component-based API? Let's take a closer look at that approach.

## Component-Based API

One of the fundamental differences between a turn-based API and a component-based API is that components are tangible whereas turns are not. REST, as an architectural style, does not concern itself with this distinction but as humans and as programmers it seems more natural from an object-oriented point of view to model the API after the components of the game.

Using components as the resources in our API means we would have resources beneath `/games/{gameId}` for each type of component in the game. For Pegger our one and only type of component is the pegs, which could be reflected in the API as `/games/{gameId}/pegs/{pegId}`, where `{pegId}` is always a number between one and six.

Since the only action to be taken on a turn is to move a peg, we would expect the API to allow a peg to be updated with either a PUT or a PATCH containing the new location of the affected peg. The full request to move peg 1 would look something like this:

{% highlight js %}
PUT /games/{gameId}/pegs/1
{
    "pegId": 1,
    "type": "red",
    "position": {
        "row": 1,
        "column": 3
    }
}
{% endhighlight %}

After the PUT is successful the software could conceptually know that the turn should then be advanced to the next player. However, if we consider more complicated games, how would the turn be advanced if the game permitted an indeterminate number of actions and the player could end their turn at any time? Using our existing model as an example, a PATCH on the game's `currentPlayer` attribute using the special value "next" would cover this situation:

{% highlight js %}
PATCH /games/{gameId}
{
    "currentPlayer": "next"
}
{% endhighlight %}

I chose PATCH here because a PUT should be idempotent whereas a PATCH is not required to be idempotent according to [RFC5789](http://tools.ietf.org/html/rfc5789#page-3). Aliases such as "next" or "previous" are also convenient for games that allow turns to be skipped or the turn order to be reversed.

The component-based approach addresses several of the issues with the turn-based approach:

1. Components that are only visible to some players can be implemented as resources that must be requested separately from the rest of the game state and require authentication and authorization.
2. Randomized components can be requested with a PATCH to indicate rolling a die for a random result or drawing the next card in a shuffled deck.
3. Turns are automatically broken up into the smallest unit of change that the game allows. This means that multi-action turns and complex turn structures are no longer a problem.
4. Client presentation of a turn is less challenging since the series of component manipulations that comprise a turn can be rendered sequentially to give the effect of a turn happening over a period of time.

There are some downsides to using the component-based approach. Modern games typically have a large number of components, which would result in a large API. Fortunately, this API will likely be very manageable if proper [object oriented principles](http://javarevisited.blogspot.com/2012/03/10-object-oriented-design-principles.html) are applied. A large REST API is also a very good candidate for [HATEOAS](https://blog.apigee.com/detail/hateoas_101_introduction_to_a_rest_api_style_video_slides) because of the improved explorability of the API.

The way that a turn is organized in a component-based API introduces two potential issues: request frequency for a single turn can be high and turns  are no longer easy to undo. In the turn-based API we would need only to delete a turn in order to reset the game back to a previous state. In the component-based API though we would need to delete many actions taken on many components in order to undo a turn. To get around the "undo" issue we could push each request onto a stack. Our undo would simply pop items from this stack until we reach the previous turn change and then rebuild the state of the game based on what is remaining in the stack.

Now that we have explored both techniques let's finish up by recapping and picking which one would best suit Pegger.

## Choosing a Technique

Turn-based APIs work very well for any game that could be easily played by mail. Games such as [Chess](http://en.wikipedia.org/wiki/Chess), [Go](http://en.wikipedia.org/wiki/Go_(game)), and [Connect Four](http://en.wikipedia.org/wiki/Connect_Four) are probably all games for which I would consider using a turn-based API because they are two-player games with a very easy turn structure and no random or hidden components.

Component-based APIs, on the other hand, are useful when random or hidden components are needed. Manipulating individual components makes it easier to record a complicated turn structure but at the cost of requiring many separate requests in order to advance or undo turns in the game. Card games such as [UNO](http://en.wikipedia.org/wiki/Uno_(card_game)), dice games such as [Yahtzee](http://en.wikipedia.org/wiki/Yahtzee), and designer games such as [Ticket to Ride](http://www.daysofwonder.com/tickettoride/) would all be excellent candidates for a component-based API.

After comparing and contrasting the two techniques it seems pretty clear that Pegger fits into the same category of games that are best-suited for a turn-based API.
