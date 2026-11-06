# Subnetting

The second workspace („Subnetting“ in the toolbar, `data-ws="subnet"`). The choice of workspace is stored (`…-workspace`); the inputs are not.

| Layer | Files |
| --- | --- |
| UI | `src/components/Subnet/` (`SubnetView`, one component per tab, `common.tsx` for tables and copy buttons) |
| State | `src/state/subnetStore.ts` (`useSubnet`, trainer functions, achievement triggers) |
| Logic | `src/lib/subnet/` (`ipv4.ts`, `divide.ts`, `ipv6.ts`, `exercises.ts` types and entry points, `generators.ts`, `answers.ts` checks, `explain.ts` worked solutions, `random.ts`, re-exported by `index.ts`) |
| Texts | `src/i18n/subnet.ts` (`workspaceText`, `subnetText`) |
| Tests | `src/lib/subnet/*.test.ts` (Vitest), `tests/e2e/test_subnetting.py` |

Everything in `src/lib/subnet` is pure: no React, no store, no language. Addresses are unsigned 32-bit numbers (`>>> 0`); IPv6 addresses are arrays of eight 16-bit groups. Errors are returned as typed codes (`ParseError`, `Tip`, `SplitResult.error`) and turned into text in the components.

## Tabs

| Tab | Id | Does |
| --- | --- | --- |
| Rechner | `calc` | analyses `address/prefix`, `address mask` or address plus separate mask: network, broadcast, host range, usable hosts, mask, wildcard, class, range kind, binary view with network and host bits |
| Subnetze aufteilen | `split` | equal split into the next power of two ≥ the wanted count (max. 4096), and VLSM by host requirement |
| IPv6 | `ipv6` | shortens and expands, network prefix, number of /64 subnets, address type |
| Üben | `train` | random exercises of one kind or mixed, check per field, show solution, streak |

## Rules Implemented

### IPv4 (`ipv4.ts`)

- Usable hosts: 2^(32 - prefix) - 2; /31 has 2 (point-to-point link, RFC 3021) and /32 has 1. Both have no broadcast
- Masks must be contiguous (`maskToPrefix` returns `null` otherwise)
- `prefixForHosts(n)` uses the classic rule (network and broadcast reserved), smallest subnet /30
- Range kinds: private (RFC 1918), loopback, link-local, CGNAT, „this network“, documentation (RFC 5737), multicast, reserved, limited broadcast, otherwise public
- Classes A to E by the first octet; `classfulPrefix` gives /8, /16, /24

### Split and VLSM (`divide.ts`)

- `splitEqual` borrows `ceil(log2(count))` bits and starts at the network address even when a host address is entered
- `vlsm` sorts by required block size (largest first, equal sizes keep the input order) and allocates without gaps from the start of the network. Requirements that do not fit or have an invalid host count are reported in `failed`; smaller ones are still allocated
- `freeBlocks` describes the rest as the fewest aligned CIDR blocks

### IPv6 (`ipv6.ts`)

- Parses full, shortened and IPv4-embedded notation (`::ffff:192.0.2.1`)
- `shortenIpv6` follows RFC 5952: lower case, no leading zeros, the longest run of at least two zero groups (the first on a tie) becomes `::`, a single zero group stays `0`
- Address types: unspecified, loopback, IPv4-mapped, documentation, link-local, unique local, multicast, global unicast, other

## Exercises (`exercises.ts`)

| Kind | Task | Fields |
| --- | --- | --- |
| `networkBroadcast` | private address with prefix /16 to /30 | network, broadcast |
| `hostRange` | private address with prefix /18 to /30 | first host, last host, hosts |
| `hostCount` | prefix /18 to /30, shown as prefix or mask | hosts |
| `maskToPrefix` | mask for /9 to /30 | prefix |
| `prefixToMask` | prefix /9 to /30 | mask |
| `split` | network, 3 to 14 subnets, the n-th one | new prefix, network, broadcast of subnet n |
| `vlsm` | /24 and three departments with distinct block sizes | network and prefix per department |
| `ipv6Shorten` | documentation address written out | short form |
| `ipv6Expand` | documentation address shortened | full form |
| `ipv6Subnets` | prefix /29 to /60 and a target length | number of subnets |
| `hostSubnet` | network split into /n, a host | subnet number (from 1), network, broadcast |
| `sameSubnet` | two devices with one mask | network of each, same subnet yes/no |
| `hostsToPrefix` | host count incl. edge cases 2^n − 2 and 2^n − 1 | smallest prefix or mask, usable hosts |
| `subnetsToPrefix` | network, subnet count, optional minimum hosts | prefix or mask, real subnet count, hosts per subnet |
| `reverseMask` | network and broadcast | prefix or mask, hosts |
| `wildcard` | network => wildcard, or ACL line => prefix and hosts | wildcard or prefix and hosts |
| `summarize` | 2 to 8 networks (hard: mixed sizes, gaps) | smallest covering route (`cidr`) |
| `routeContents` | route and a longer prefix | count, first and last network |
| `findMistake` | device table (IP, mask, gateway) or address plan with one injected mistake | faulty row, mistake (both `choice`) |
| `vlsmScenario` | company, school or branches text, optional reserve and WAN links | network and prefix per segment; any aligned, non-overlapping plan inside the network counts (`checkPlan`) |
| `ipv6Prefix` | address with prefix, optional site prefix | network prefix, subnet ID (hex) |
| `ipv6NthSubnet` | site prefix and n | n-th /64 (counted from 1) |
| `ipv6Type` | address | type (`choice`) |
| `eui64` | MAC address | interface ID, link-local address |

- `generateExercise(random, kind?, level?)` takes a random function and a difficulty (`easy` only touches the 4th octet, `medium` reaches the 3rd, `hard` uses class A/B ranges, public addresses and IPv6 traps); tests use `seededRandom(seed)` (mulberry32) for reproducible tasks
- Every task has a `variant` that picks one of several phrasings in `subnetText.prompts`
- `nextKind(random, previous)` is used for „Gemischt“ and never returns the previous kind
- Fields can carry `traps` (typical wrong values with their own tip), `options`/`accepted` for `choice` fields and `prefix` for network addresses written with /n
- `explain(exercise)` returns the worked solution as typed steps; the trainer shows them after „Lösung zeigen“
- `checkField()` accepts several notations per answer kind; see the table in `docs/check-rules.md`
- Department names are ids (`DepartmentId`) and are translated at render time

## Trainer and Achievements

- `calculated(valid)` is called after every input change in the tool tabs and unlocks `subnet_first` on the first valid result
- `checkAnswers()` unlocks `subnet_ok` and raises `subnets` (=> `subnet10`) only when the exercise is solved for the first time and the solution was not shown
- The streak counts consecutive solved exercises; a wrong check or showing the solution of an unsolved exercise resets it. It is not stored

## Adding an Exercise Kind

1. Add the kind to `ExerciseKind` and `EXERCISE_KINDS`, the task shape to `ExerciseTask`, and a generator to `GENERATORS` (`exercises.ts`)
2. Reuse an existing `AnswerKind` or add one with its rule in `checkField()`
3. Name and task text in `subnetText.kinds` and the prompt texts (`src/i18n/subnet.ts`), German and English; render the task in `TrainerTab.tsx`
4. Unit tests: the generator is covered by „produces solvable tasks of every kind“; add specific cases to `exercises.test.ts`
5. Update the table above and `README.md` if users see a new kind
