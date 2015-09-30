---
layout: post
title: Modeling a Turn-Based Game with JSON
author: erik
category: programming
tags: [pegger,tutorial]
permalink: /2014/08/26/modeling-a-turn-based-game-with-json
excerpt: >
    Since my first tutorial for building out my turn-based game, Pegger, I have been thinking a lot about how to design a REST API around it. In this particular article my focus will be on creating a data model for Pegger and representing that model using JSON so don't worry if you're not intimately familiar with REST and HTTP yet.
---

Since my [first tutorial]({{ site.baseurl }}{% post_url 2014-08-11-creating-a-jersey-app-on-google-app-engine %}) for building out my turn-based game, Pegger, I have been thinking a lot about how to design a REST API around it. But before I get too far into this article, let me first clear one thing up. When I say REST API I mean a Level 2 REST API according to the [Richardson Maturity Model](http://martinfowler.com/articles/richardsonMaturityModel.html#level2). My goal is to create an API that uses URIs as resources and HTTP verbs to interact with those resources. We will make use of other aspects of HTTP as well as use JSON to structure our payloads, but I have no intention to go full blown [HATEOAS](http://timelessrepo.com/haters-gonna-hateoas) on this thing.

If you are unfamiliar with REST then I recommend you read up on some of the basics before getting to far into the rest of this tutorial series. REST (short for REpresentational State Transfer) is an [architectural style](http://www.ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm) described by Roy Fielding in a dissertation that he wrote in 2000. If you don't want to read a dissertation to learn about REST then I think Sam Berry's [Building a RESTish API](https://docs.google.com/presentation/d/1xul-mmrOeilaFX733Dxgl6UYxB7X-bFy6JUqcEGipvM/edit#slide=id.p) and Vinay Sahni's [Best Practices for a Pragmatic RESTful API](http://www.vinaysahni.com/best-practices-for-a-pragmatic-restful-api) are good intros and practical takes on REST.

In this particular article my focus will be on creating a data model for Pegger and representing that model using JSON so don't worry if you're not intimately familiar with REST and HTTP yet.

**Edit:** I have received feedback about my use of the term "REST" and the broader REST community seems to agree that the term has become conflated. One of the fundamental aspects of REST that I have been overlooking is the use of hypermedia. Since I am not intending to use hypermedia (yet) for Pegger, I think it is better that I start referring to my API as HTTP instead of REST to avoid confusion and unrest. Within this article please assume that any time I use the term REST I effectively mean REST-sans-hypermedia (which isn't REST at all!) or just plain HTTP.

## The Rules for Pegger

Pegger is a two-player turn-based strategy game that is played on a [2x4 pound-a-peg toy](http://amzn.com/B00005LOXV). The game setup is easy: take one pair of colored pegs and the hammer and give them to the nearest toddler but we will need all of the remaining pieces. Arrange the remaining pegs (green, red, and yellow in my case) into the starting positions as shown below. The white circles indicate empty holes, all other colored circles indicate where a colored peg should be placed in the board.

{% include image.html src="/img/posts/pegger/peggerinitialstate.png" caption="The starting peg arrangement." %}

The goal of Pegger is to be the first player to move a red or green peg into a hole adjacent to the other peg of the same color. Yellow pegs do not count towards the victory condition, they are considered neutral.

Victory is achieved by taking turns moving pegs. A turn consists of either moving a colored peg into an adjacent hole or by jumping one peg over an adjacent peg and into a hole. For example, in the starting configuration shown above the first player may move the green peg from hole 5 into hole 6, move the red peg from hole 1 into hole 3, move the yellow peg from hole 2 into hole 3, and so on. A peg must be moved during the player's turn.

The only other constraint when taking a turn is that you cannot undo your opponent's most recent turn. For example, if the first player moves the green peg from hole 5 into hole 6 then the second player cannot move the green peg from hole 6 back into hole 5.

That's it for the rules. It's a pretty simple game and that's exactly why I'm using it for my first attempt at creating a REST API that models a game.

## Modeling Game State

The way that we will be accessing game state will be via HTTP using the typical set of [verbs](http://en.wikipedia.org/wiki/HTTP_Verbs#Request_methods) and [status codes](http://en.wikipedia.org/wiki/List_of_HTTP_status_codes). For now we are trying to show, using JSON, what the state of the game may be at any given time. In future articles we will discuss at further length how to establish an API to alter the game state.

So what do we know about the state of a game of Pegger? We know the game is played on a board with two rows and each row consists of four holes. We know that there are always two green pegs, two red pegs, and two yellow pegs that will go in those holes and we even know the starting position for each of those pegs. We also know that the game requires exactly two players and that we need to know what the previous player's turn was because it cannot be immediately undone by the current player.

Component-wise, that gives us a board, the pegs, and a couple of players (let's not put too much thought into whether players are actually game components). All of these things will exist at any given time over the course of a game of Pegger. Let's see what these items might look like if we present them as JSON:

{% highlight js %}
{
  "gameId": 8623847623,
  "player1": 12345,
  "player2": 67890,
  "lastTurn": null,
  "board": {
    "rows": 2,
    "columns": 4,
    "pegs": [
      {
        "pegId": 1,
        "color": "red",
        "neutral": false,
        "position": {
          "row": 1,
          "column": 1
        }
      },
      {
        "pegId": 2,
        "color": "yellow",
        "neutral": true,
        "position": {
          "row": 1,
          "column": 2
        }
      },
      {
        "pegId": 3,
        "color": "green",
        "neutral": false,
        "position": {
          "row": 1,
          "column": 4
        }
      },
      {
        "pegId": 4,
        "color": "green",
        "neutral": false,
        "position": {
          "row": 2,
          "column": 1
        }
      },
      {
        "pegId": 5,
        "color": "yellow",
        "neutral": true,
        "position": {
          "row": 2,
          "column": 3
        }
      },
      {
        "pegId": 6,
        "color": "red",
        "neutral": false,
        "position": {
          "row": 2,
          "column": 4
        }
      }
    ]
  }
}
{% endhighlight %}

You'll see that I included an identifier attribute on the game and each peg. My rationale for doing this is that we will have more than one of either of these entities and it will be important to be able to uniquely identify any one of them once we start interacting with game.

When I type something like this out I like to review it to see how it "feels". The structure above seems decent but there are a few things that don't feel quite right that I think need to be addressed:

1. The last turn taken is clearly something we need to track but what will it look like?
2. We are tracking the last turn but until there has been at least one turn how do we know who the current turn belongs to?
3. Tracking a peg's color and neutrality separately seems redundant. We know red and green pegs always count toward victory conditions and we know that yellow pegs are always neutral.
4. The color attribute for pegs suggests that the server is dictating which color a client should use when rendering a peg. What if a player is colorblind?

To address these concerns let's see what a representation of the game might look like after the first player's turn. This will at least help define what the `lastTurn` attribute should look like. To address the other concerns let's add another attribute to indicate whose turn it is and consolidate the `color` and `neutral` peg attributes into a single attribute named `type`.

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
      {
        "pegId": 2,
        "type": "yellow",
        "position": {
          "row": 1,
          "column": 2
        }
      },
      {
        "pegId": 3,
        "type": "green",
        "position": {
          "row": 1,
          "column": 4
        }
      },
      {
        "pegId": 4,
        "type": "green",
        "position": {
          "row": 2,
          "column": 1
        }
      },
      {
        "pegId": 5,
        "type": "yellow",
        "position": {
          "row": 2,
          "column": 3
        }
      },
      {
        "pegId": 6,
        "type": "red",
        "position": {
          "row": 2,
          "column": 4
        }
      }
    ]
  }
}
{% endhighlight %}

After making the aforementioned changes the model feels much improved. The `toPosition` attribute of the last turn seems a little redundant since we have the current position of the peg but I think that keeping both positions near each other in the data model will prevent unnecessary searching when we eventually have to validate the "you cannot undo the last turn" rule. Consolidating the `color` and `neutral` attributes into a single `type` attribute seems better but I will continue using color names as the values to make it easy for humans to interpret the game. This makes the switch from a `color` attribute to `type` seem mostly semantic but for now let's keep the attribute named `type`.

At this point it seems like the data model is well enough defined that we can move on. We have already iterated over the data model once and discovered a handful of minor issues so I think for now we can call the model a first draft. As we dive into the API we will probably realize that something was missed. Perhaps the decisions we have made will lead to complications in the game logic. We have to start somewhere though, and there is nothing wrong with making changes later. For now we will move forward with the assumption that the data model and API will evolve as we dive deeper into the details.

## Summary

In order to model a turn-based game you will need to know both the components that make up the game and the rules. It is also important to keep track of each player that is part of the game and to which of those players the current turn belongs.

Set up the game you are attempting to model and try to describe it using JSON. Play a turn or a full game round and attempt to describe the game again using the same JSON structure. Make sure to capture any details that a future player may need in order to successfully take their turn without violating any rules of the game.

After you have a decent representation of your game remember that it is still just an early draft. You will undoubtedly make small touch-ups here and there as you continue to develop the rest of your game's API.
