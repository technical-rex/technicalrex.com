---
layout: post
title: "Quickly Upgrade Your GitHub Pages Site to Jekyll 3"
author: erik
category: programming
tags: []
permalink: /upgrade-github-pages-site-to-jekyll-3/
excerpt: >
  <p>GitHub recently upgraded their GitHub Pages platform (a.k.a. free static 
  site hosting!) from Jekyll 2.4 to Jekyll 3.0. They published an article about
  the changes, but it didn't seem very comprehensive. After reading it, I
  generally felt like things should just continue to work... but they
  didn't.</p> I've since gone through four static sites and upgraded them to
  Jekyll 3. Here's the quick and dirty version of what I had to do to get those
  sites looking pretty and working the way I expected them to.
---

GitHub recently upgraded their [GitHub Pages][1] platform (a.k.a. free static site hosting!) from Jekyll 2.4 to Jekyll 3.0. They published an [article about the changes][2], but it didn't seem very comprehensive. After reading it, I generally felt like things should just continue to work... but they didn't.

I've since gone through four static sites and upgraded them to Jekyll 3. Here's the quick and dirty version of what I had to do to get those sites looking pretty and working the way I expected them to.

## Pagination

Let me start with the item that wasn't covered in GitHub's migration notes. If you were using pagination (aren't we all?), then you may have noticed that the styles on your page look goofy, random Markdown shows up in your HTML, and you may even be getting this message in your logs:

{% include image.html src="/img/posts/jekyll-paginate.jpg" %}

If all this rings true, then add the following lines to the end of your `Gemfile`:

```ruby
group :jekyll_plugins do
  gem 'jekyll-paginate'
end
```

If you want to use any other Jekyll plugins, put them in the `:jekyll_plugins` group too. Be careful though, only certain plugins are supported by GitHub Pages!

## Bundle

Regardless of whether you had to fix the `jekyll-paginate` issue, make sure to run `bundle update`. This will make sure you are running the same version of the `github-pages` gem (and all of its dependencies) as GitHub Pages itself.

## Kramdown

GitHub Pages now **only** supports Kramdown as its Markdown processor. What does that mean to you?

1. Remove the `markdown:` property from your `_config.yml` file.
2. If your pages look funky and you were using something besides Kramdown, add these lines to `_config.yml`:

```yaml
kramdown:
  input: GFM
```

## Syntax Highlighting

If you have code snippets on your blog, you should know that GitHub Pages now **only** supports Rouge for making your snippets look pretty. Since only one highlighter is supported now, remove the `highlighter:` property from your `_config.yml` file.

#### Extra Credit

If you were using `{% raw %}{% highlight lang %}{% endraw %}` to declare code snippets in your Markdown files, you can instead use backticks:

**Before:**

```md
{% raw %}
  {% highlight html %}
  <h1>Hello World!</h1>
  {% endhighlight %}
{% endraw %}
```

**After:**

```md
{% raw %}
  ```html
  <h1>Hello World!</h1>
  ```
{% endraw %}
```

## The End

I hope you found what you were looking for. Happy hosting!

[1]: https://pages.github.com/
[2]: https://github.com/blog/2100-github-pages-now-faster-and-simpler-with-jekyll-3-0
