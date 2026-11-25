# Glossary

Terms used across Hishab. Bangla UI words are shown in brackets.

## Money in a month

- **Income** (আয়): money that comes in during a month. It is **expected** until it has a date, and **received** once it arrives.
- **Savings target** (সঞ্চয়ের লক্ষ্য): what the month plans to set aside before spending.
- **Savings held**: the savings target minus anything lent out of savings. Never below zero.
- **Carry**: what a month starts with. It is the counted **starting cash** if one is set, otherwise the previous month's remaining money.
- **Spendable**: income plus carry, minus the savings target. The pool the plan and the daily spending draw from.
- **Committed**: what repeating budget lines still need this month. Only repeating lines are committed.
- **Remaining**: spendable minus spending and minus money lent from spending.
- **Left after saved**: what a month really kept: carry plus received income, minus savings, spending and everything lent.

## Loans

- **Loan** (ধার): money lent to someone. It leaves the month's cash but is not spending.
- **Loan source**: where the lent money came from, either spending money (খরচের টাকা থেকে) or savings (সঞ্চয় থেকে).
- **Repayment** (ধার ফেরত): an income that is money coming back from a loan. It can arrive in any month.
- **Open loan**: a loan with money still owed. A loan is **closed** once its repayments cover it.
- Deleting a loan also deletes its repayments, since a repayment has no meaning without its loan.

## Month lifecycle

- **Lock** (লক): a promise not to change the month's plan. A locked month still takes facts: spending, loans, received income, cash counts and starting cash.
- **Close** (বন্ধ): the month-end step. It records what was saved, counts cash, and starts the next month from that cash. Closing also locks the month.
- **Reopen** (আবার খোলো): undoes the closed mark only. The lock, saved amount, cash count and next month's starting cash stay until the month is closed again.
- **Book balance**: the cash the records say should be left on the close date, after savings.
- **Gap**: book balance minus counted cash. A positive gap is money spent but never written down.
- **Forward**: what the next month starts with after a close: the counted cash, or the book balance when cash was not counted.

## Checking cash

- **Check** (মিলানো): a cash count on a given day.
- **Expected cash**: what the records say should be in hand on a check's day.
