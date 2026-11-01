# Customer status and note

A held payment used to leave the customer with a status word and nothing else. Now the History tab says in one plain sentence what the state means for their money, and a customer whose payment is waiting for review can send the reviewer one short note.

## What the customer sees

| Payment state | Sentence |
|---|---|
| Held | A person is reviewing this payment. Nothing is charged until they decide. |
| Voided | This payment was not completed and you were not charged. |
| Anything else | No extra sentence. |

The sentence never names a rule, a score, a device or a signal. A test fails if the wording contains one of those words, so a later edit cannot start explaining the detection to the person it is aimed at.

## The note

- `POST /api/v1/transactions/:id/appeal` with `note` (5 to 250 characters after trimming). Only the owner of the payment, only while it is held, only once.
- It is saved as an audit row (`CUSTOMER_APPEAL`) with the customer as actor. It changes nothing about the payment: a person still decides, and the AI analyst's inputs do not include the note.
- The reviewer sees it on the case, in the same list as review notes and proposals, as written by a customer.
- The transactions list carries `customer_message`, `can_appeal` and the note once sent, loaded for the whole page in one query.

## Not claimed

- The note is free text from the customer. It is shown as text, never run, and never sent to the model.
- It does not speed up or approve a payment. We have not measured whether notes change reviewer decisions.
- There is no notification to the reviewer; the note appears when they open the case.

## Tests

`test/integration/appeals_test.rb` covers login, ownership, held-only, one note, length rules, the history fields, the wording rule and the reviewer view. Frontend: `AppealDialog.test.tsx` and `TransactionTable.test.tsx`.
