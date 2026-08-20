# rxjs-bindings — Project Overview

## What is rxjs-bindings?

`rxjs-bindings` is a small experimental web application architecture built with **RxJS 7**, **TypeScript JSX**, and standard browser APIs.

The project asks a simple question:

> How much of a modern web framework can be expressed directly with RxJS, TypeScript, JSX, and the browser without introducing a large framework runtime?

The answer turned out to be: quite a lot.

The project now demonstrates solutions for:

- DOM data binding
- application state
- form controls and validation
- HTTP request state
- browser routing
- animation
- JSX-based views
- view lifetime and cleanup
- a complete CRUDL Todo application

The goal is not to reproduce Angular feature by feature, and it is not to hide RxJS behind a new framework API.

The goal is the opposite:

> Keep the browser visible. Keep RxJS visible. Keep TypeScript functions visible. Add only the small amount of glue that is genuinely missing.

This produces a web architecture with a surprisingly small conceptual core.


## The main idea in one picture

A typical application in `rxjs-bindings` can be understood as a flow:

```text
Browser / DOM events
        |
        v
      RxJS
        |
        v
pure TypeScript functions
        |
        v
application state and effects
        |
        v
     RxJS streams
        |
        v
small DOM bindings
        |
        v
       DOM
```

TypeScript JSX is used to create the DOM structure itself:

```text
TypeScript JSX
      |
      v
   DOM structure
```

So there is a clear division of responsibilities:

```text
TypeScript JSX  -> what the page structure looks like
RxJS            -> what happens over time
TypeScript      -> what values mean and how they are transformed
rxjs-bindings   -> how changing values are applied to the DOM
Browser APIs    -> the actual browser effects
```

That separation is the central design of the project.


## What is RxJS, in practical terms?

A reader does not need to know all of RxJS to understand this project.

The most useful starting point is to think of an RxJS `Observable` as:

> A source of values that can arrive over time.

A button click is a value arriving over time.

Text typed into an input is a sequence of values arriving over time.

HTTP responses arrive over time.

The browser URL changes over time.

Animation frames arrive over time.

Application state changes over time.

RxJS gives us one common way to work with all of them.

For example, instead of writing an event handler that immediately performs several unrelated mutations, we can turn the event into a stream:

```text
button clicks
     |
     v
   click$
```

Then values can be transformed, filtered, combined, accumulated into state, or used to start other asynchronous work.

This is why RxJS is more than an "HTTP library" or an "event library" in this project.

It becomes the **execution model of the application**.


## Enter the RxJS world, stay there, then exit

A useful mental model for `rxjs-bindings` is that an application has three phases.

### 1. Enter the RxJS world

Browser events become Observable streams.

For example:

```text
DOM click
   |
fromEvent()
   |
   v
 click$
```

The standard RxJS `fromEvent()` function is used directly.

The project deliberately does not invent a wrapper such as `bindEvent()` because that would only rename an already clear RxJS primitive.


### 2. Stay in the RxJS world

Once events have entered the reactive pipeline, the application tries to remain there.

Values are transformed with ordinary RxJS operators and ordinary TypeScript functions.

Application state can be built from actions.

HTTP requests can be started and cancelled.

Routes can be interpreted.

Animations can run.

The important point is that the application does not constantly jump back into imperative code to mutate unrelated variables.


### 3. Exit the RxJS world

Eventually a value has to affect the real browser.

That is where the small `rxjs-bindings` DOM functions are used.

Examples include:

- `bindText()`
- `bindProperty()`
- `bindAttribute()`
- `bindClass()`
- `bindStyle()`

These functions are intentionally simple.

They do not contain business logic.

They only connect an Observable value to a browser DOM effect.


## DOM bindings: the smallest missing piece

RxJS already knows how to receive DOM events through `fromEvent()`.

What RxJS does not provide is a standard set of DOM output functions.

That is why the project contains bindings such as:

```text
Observable<string>
      |
      v
  bindText()
      |
      v
 DOM text
```

or:

```text
Observable<boolean>
      |
      v
 bindProperty()
      |
      v
button.disabled
```

This creates an important symmetry:

```text
DOM -> RxJS     fromEvent(...)

RxJS -> DOM     bindText(...)
                bindProperty(...)
                bindAttribute(...)
                bindClass(...)
                bindStyle(...)
```

The binding layer is therefore not meant to become a hidden framework runtime.

It is simply the narrow boundary where reactive values reach the browser.


## No change-detection loop

Many web frameworks maintain some kind of rendering or change-detection mechanism that decides when the user interface should be refreshed.

`rxjs-bindings` takes a different approach.

A DOM binding updates only when its Observable emits a new value.

Conceptually:

```text
count$

0 -------- 1 -------- 2 -------- 3
|          |          |          |
v          v          v          v
DOM        DOM        DOM        DOM
```

There is no general "check the application and see what changed" loop.

The stream already tells us that something changed.

This is a natural consequence of using RxJS as the application execution model.


## State is also a stream

Application state is not stored in a special framework object.

Instead, the project models state as a remembered Observable.

The pattern is:

```text
Actions
  |
  v
scan(reducer)
  |
  v
State$
  |
shareLatest()
```

`scan()` is similar to `Array.reduce()`, except it works over values arriving over time.

An action might say:

```text
increment
rename
delete todo
toggle completed
```

A pure reducer receives the current state and the action and calculates the next state.

The project then uses `shareLatest()` so that:

- all consumers share one state execution,
- the latest state value is remembered,
- a new subscriber can immediately receive the current state,
- the upstream execution can disconnect when it is no longer used.

In ordinary language:

> State is a stream that remembers its latest value.


## Pure TypeScript functions contain the application meaning

One of the strongest design rules in the project is:

> RxJS operators should remain visible, while domain behavior should be expressed by well-named TypeScript functions.

For example, the project prefers the idea:

```text
map(priceCart)
```

over hiding `map()` inside a custom domain-named operator.

Why?

Because the code then tells us two things at once:

```text
map           -> what kind of RxJS transformation is happening
priceCart     -> what the domain operation means
```

This keeps the reactive mechanism understandable while still giving the application meaningful names.

The same principle appears throughout the project:

- reducers are pure functions,
- validators are pure functions,
- route parsers are pure functions,
- easing functions are pure functions,
- interpolation functions are pure functions.

RxJS moves values through time.

Plain TypeScript determines what those values mean.


## TypeScript JSX provides the view structure

The project uses TypeScript JSX, but not React.

The TypeScript compiler transforms JSX into calls to the project's own `jsx()` function.

So this:

```text
<section>
  <h2>Todo</h2>
</section>
```

becomes direct DOM construction through the local JSX factory.

There is:

- no React runtime,
- no virtual DOM,
- no component class,
- no template compiler,
- no hook system.

JSX has one responsibility:

> Describe and create DOM structure.


## JSX does not hide RxJS

A very deliberate decision in the project is that JSX does not secretly subscribe to Observable values.

The project avoids magical ideas such as:

```text
<h1>{title$}</h1>
```

where a JSX runtime would have to detect that `title$` is an Observable, subscribe to it, update the DOM, and somehow manage cleanup.

Instead, the structure and the reactive behavior remain separate:

```text
create <h1> with JSX
        |
        v
bindText(heading, title$)
```

The same rule applies to events.

JSX event attributes such as `onClick` are intentionally not the reactive mechanism.

Events enter through normal RxJS:

```text
fromEvent(button, 'click')
```

This keeps subscription behavior and event flow visible.


## A view is structure plus lifetime

Once JSX creates DOM structure, the next problem is lifecycle.

What happens when a view disappears?

Its event streams, bindings, HTTP work, animations, and child views may all need to stop.

The project uses an existing RxJS concept instead of inventing a second lifecycle framework:

> `Subscription` is the view lifetime.

A view therefore has two essential parts:

```text
View
 |
 +-- DOM node
 |
 +-- RxJS Subscription lifetime
```

When the view lifetime is unsubscribed:

- registered RxJS subscriptions stop,
- registered teardown functions run,
- the view can be removed from the DOM.

This means the project does not need a parallel lifecycle vocabulary such as:

```text
onInit
onDestroy
useEffect
DestroyRef
componentWillUnmount
```

The RxJS execution already has a lifecycle model.


## Forms without a framework FormControl object

The project includes a Form Control implementation, but it does not recreate Angular's mutable `FormControl` class.

A form control is modeled as data.

Its state contains things such as:

```text
value
dirty
touched
validation errors
```

User input, blur events, programmatic value changes, and reset commands become actions.

Those actions are reduced into a new control state.

Validation is performed by normal pure TypeScript functions.

Values such as "valid" or "pristine" do not need to be stored separately because they can be calculated from the real state.

For example:

```text
valid = there are no validation errors
pristine = not dirty
untouched = not touched
```

The important idea is:

> A form control is a stream of control state, not a special mutable framework object.


## HTTP as a state transition

An HTTP request is not only a response that appears later.

From a user's point of view, a request has a lifecycle:

```text
Idle
  |
  v
Loading
  |
  +----> Success
  |
  +----> Error
```

`rxjs-bindings` represents this explicitly with `LoadingState`.

That prevents awkward combinations such as:

```text
loading = true
data = some value
error = some error
```

all being present at the same time.

Instead, the state itself tells us which situation exists.

RxJS also makes request cancellation policy explicit.

For example, `switchMap()` means:

> If a newer request starts, stop caring about the previous active request and follow the latest one.

This is useful for search boxes, route-driven requests, and many interactive applications.


## Routing as browser location over time

The Router implementation starts from the browser rather than from a large routing framework abstraction.

The browser already has:

- a URL,
- history,
- Back and Forward,
- `pushState()`,
- `replaceState()`,
- `popstate`.

The project turns these into a remembered `Route$`.

Conceptually:

```text
Browser location
      |
      v
   Location$
      |
      v
parseRoute()
      |
      v
    Route$
```

Routes are ordinary typed TypeScript values, such as:

```text
Home
User(id)
Settings
NotFound(path)
```

The route parser decides what a URL means.

RxJS coordinates changes over time.

The browser History API performs the actual navigation effect.

This leads to a simple rule:

> Route meaning is TypeScript data, navigation mutation is a browser effect, and time coordination is RxJS.


## Animation is just another time-based stream

The animation implementation follows exactly the same philosophy.

RxJS already provides browser animation frames through `animationFrames()`.

Those frame times are converted into progress from `0` to `1`.

Pure functions then perform:

- easing,
- interpolation,
- value calculation.

Finally `bindStyle()` applies the resulting style value to the DOM.

So an animation becomes:

```text
frame time
   |
   v
progress
   |
   v
easing
   |
   v
interpolation
   |
   v
style value
   |
   v
DOM
```

This removes the need for a separate animation language for many application-driven animations.


## RxJS operators become execution policies

One of the most useful ideas demonstrated by the project is that common RxJS operators describe execution policy.

Suppose a new event starts some asynchronous work.

There are several possible policies.

`switchMap()` means:

> Replace the current work with the latest work.

`concatMap()` means:

> Queue the new work until the current work finishes.

`mergeMap()` means:

> Allow several executions to run at the same time.

`exhaustMap()` means:

> Ignore new requests while the current execution is active.

These policies are useful for much more than HTTP.

They can describe:

- request behavior,
- animation behavior,
- asynchronous validation,
- route-driven effects,
- background work,
- user interactions.

The same small RxJS vocabulary can therefore coordinate many different parts of an application.


## Subjects are bridges, not state containers

The project does use RxJS `Subject` in a few places.

But its role is deliberately narrow.

A Subject is useful when imperative code has to inject an event into a reactive flow.

For example:

```text
programmatic navigation
        |
        v
      Subject
        |
        v
   reactive router
```

or a dynamically created Todo row may emit an action back into the application's action stream.

The Subject does not own the application state.

State remains in the normal state pipeline.

A useful project rule is:

> Use a Subject as a bridge into a stream, not as a mutable store.


## The CRUDL Todo application: the end-to-end proof

The `/sample` directory contains a complete Todo application.

It is important because it demonstrates that the individual ideas can work together as an application rather than only as isolated experiments.

The sample implements CRUDL:

- **Create** a Todo.
- **Read** a selected Todo.
- **Update** its title or completed state.
- **Delete** a Todo.
- **List** all current Todos.

The application flow is:

```text
DOM events
   |
   v
Todo actions
   |
   v
scan(reducer)
   |
   v
TodoState$
   |
shareLatest()
   |
   +----> text/property/class/attribute bindings
   |
   +----> keyed JSX Todo views
   |
   +----> localStorage persistence
```

The Todo sample also demonstrates an important development principle of the project.

Its keyed list renderer currently lives in the sample rather than the framework core.

That is intentional.

The project prefers to:

> Prove an abstraction in a real application before promoting it into the core API.

This helps keep the framework small.


## Relationship to Angular

`rxjs-bindings` was partly inspired by asking what common Angular responsibilities look like when expressed directly with RxJS, TypeScript, and browser APIs.

There are recognizable correspondences:

```text
Angular template              -> TypeScript JSX
text interpolation            -> bindText()
property binding              -> bindProperty()
attribute binding             -> bindAttribute()
class binding                 -> bindClass()
style binding                 -> bindStyle()
event binding                 -> fromEvent()
component state               -> scan() + shareLatest()
FormControl                   -> ControlState$
HTTP request state            -> LoadingState$
Router / ActivatedRoute       -> Route$
animations                    -> animationFrames() + RxJS policies
component lifetime            -> Subscription
```

But the project is not trying to become "Angular without Angular."

The more useful question is always:

> What behavior is actually needed?

Then the project looks for the smallest combination of:

- browser primitives,
- RxJS,
- pure TypeScript,
- and a small DOM boundary.

Sometimes that produces something similar to a framework feature.

Sometimes it makes the framework abstraction unnecessary.


## A useful side effect: an Angular concepts introduction

There is another way to read this project that was not the original goal but became increasingly clear during development.

`rxjs-bindings` can also serve as an **introduction to Angular concepts by showing the underlying behavior without the Angular machinery first**.

For someone new to Angular, concepts such as data binding, reactive forms, routing, HTTP request state, animations, component lifetime, and template views can initially look like unrelated framework features. In this project, those same ideas are reduced to smaller building blocks:

```text
Angular concept                 Underlying idea shown here

Template / component view      TypeScript JSX creates DOM structure
Event binding                  browser event -> fromEvent()
Property / text binding        Observable value -> DOM sink
Component state                actions -> scan() -> remembered State$
Reactive FormControl           ControlState$ evolving over time
HttpClient request handling    LoadingState$ + explicit request policy
Router / ActivatedRoute        browser location -> typed Route$
Animations                     frame time -> progress -> DOM style
Component destruction          unsubscribe the view lifetime
```

This makes the project useful in two directions.

An RxJS developer can use it to understand how familiar framework responsibilities can be assembled from reactive primitives. An Angular learner can use it in the opposite direction: first understand the small underlying behavior, then recognize why Angular provides a higher-level abstraction for it.

For example, Angular's Router becomes easier to understand after seeing that routing fundamentally needs to observe browser location changes, interpret a URL as typed route data, perform History API effects, and keep the current route available to consumers. Angular's abstraction then has concrete behavior underneath it rather than appearing as framework magic.

The same is true for Reactive Forms. A `FormControl` becomes easier to reason about after seeing value changes, blur events, validation, dirty/touched state, and reset behavior represented explicitly as state transitions.

So the project can be read as a small tutorial in **what common Angular features fundamentally do**, before learning Angular's full syntax and APIs.

This is not an argument that Angular should never provide those abstractions. It is an educational advantage: understanding the reduced mechanism first often makes the framework abstraction easier to understand later.


## What rxjs-bindings deliberately does not try to hide

The project tries to avoid creating a new layer of vocabulary when an existing primitive is already clear.

That is why normal RxJS operators remain visible:

```text
map
filter
scan
switchMap
concatMap
distinctUntilChanged
fromEvent
```

It is why browser APIs such as History remain visible.

It is why JSX is used for structure rather than becoming another reactive runtime.

It is why the project does not currently include:

- a dependency injection container,
- decorators,
- component classes,
- a global mutable store,
- a custom event system,
- a virtual DOM,
- a change-detection engine,
- a template compiler,
- framework-specific replacements for standard RxJS operators.

The guiding rule is:

> Add an abstraction only when RxJS, TypeScript, or the browser does not already provide a clear primitive for the job.


## Is rxjs-bindings a framework?

It is reasonable to describe the project as a **minimal RxJS-native web framework** or, more conservatively, as a **reactive web application kernel**.

It already provides or demonstrates solutions for many responsibilities normally associated with web frameworks.

However, its purpose is not to maximize the number of framework features.

Its purpose is to discover how small the framework can remain.

That is an important difference.

The project becomes more interesting when a new capability can be expressed by composing existing primitives rather than by adding another large abstraction.


## The architectural philosophy

The project can be summarized by a few principles.

### Browser events are sources

Use browser APIs and `fromEvent()` to enter the reactive world.


### RxJS is the temporal execution model

Use Observable pipelines to coordinate values, time, concurrency, cancellation, and completion.


### Domain logic is plain TypeScript

Use pure, well-named functions for application meaning.


### State is data

Represent application and effect state explicitly instead of scattering mutable flags across the application.


### JSX owns DOM structure

Use TypeScript JSX to describe what DOM nodes exist.


### Bindings are DOM sinks

Use a very small set of functions to apply already-computed Observable values to the browser.


### Subscription owns lifetime

Use RxJS teardown rather than inventing a separate component lifecycle system.


### Standard RxJS remains visible

Do not hide useful RxJS semantics behind unnecessary wrappers.


## Why this architecture is interesting

The most interesting result of the project is not any single utility function.

It is the observation that many apparently different framework features reduce to the same few ideas:

```text
values arrive over time
      |
      v
transform / combine / accumulate
      |
      v
explicit execution policy
      |
      v
explicit state
      |
      v
browser effect
```

Forms, HTTP, routing, animation, DOM binding, and application state look different at the user-interface level.

At the execution level they share a great deal.

RxJS provides a language for that common execution model.

TypeScript provides the domain model.

JSX provides the view structure.

The browser performs the real effects.

`rxjs-bindings` is the small layer that connects them.


## Who might find this project useful?

The project may be interesting to:

- JavaScript or TypeScript developers who want to understand RxJS beyond simple HTTP calls,
- Angular developers who want to see familiar application problems expressed with smaller primitives,
- functional-programming-oriented frontend developers,
- developers interested in explicit state and effect modeling,
- people exploring alternatives to large framework runtimes,
- anyone interested in understanding what a web framework actually has to do.

It can also be read as an educational project.

The implementation makes many responsibilities visible that frameworks usually hide.

That makes it useful not only as code, but as a way to study browser application architecture.


## Where to start

If you are new to RxJS, the easiest path through the project is:

1. Start with the DOM bindings and `fromEvent()`.
2. Look at the simple state example using `scan()` and `shareLatest()`.
3. Look at the Form Control as state over time.
4. Look at HTTP `LoadingState`.
5. Look at the Router as browser location over time.
6. Look at animation as frame time over time.
7. Look at the JSX View layer and `Subscription` lifetime.
8. Finally, study the `/sample` Todo application to see the pieces work together.

You do not need to learn the complete RxJS operator library first.

A small number of concepts already explains most of the architecture.


## Final perspective

`rxjs-bindings` began with a small idea: connect RxJS values directly to the browser DOM.

As more application features were explored, the same architectural pattern kept reappearing.

The result is a compact approach to web applications:

```text
TypeScript JSX
      +
     RxJS
      +
pure TypeScript
      +
browser APIs
      +
small DOM bindings
```

The project demonstrates that a substantial amount of web-framework behavior can be built from these pieces while keeping state, time, cancellation, lifetime, and effects explicit.

Its central idea is therefore not "replace one framework with another."

It is:

> Use the smallest clear abstraction for each responsibility, and let RxJS remain the visible language of application behavior over time.
