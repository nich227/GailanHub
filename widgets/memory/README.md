# Memory

How much of the machine's memory is in use, as a number and as a twenty-division
scale.

The reading comes from `memory_pressure`, which reports how much is free. That is the
number worth trusting: macOS fills memory on purpose, so "used" out of `vm_stat` looks
alarming on a machine that is perfectly happy. The last three divisions turn red.

Reads every five seconds. Memory moves, but not the way a clock does.
