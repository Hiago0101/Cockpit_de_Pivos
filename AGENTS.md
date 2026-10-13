<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Project architecture

- Keep the web frontend presentation-only and isolate navigation/page shells from future Django REST data services so the interface can evolve without coupling to SQL Server.
- Render the standalone login route outside AppShell and keep its Microsoft sign-in control presentation-only until authentication is explicitly requested, so the login design remains independent of future identity services.
