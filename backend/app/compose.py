"""Conversational reply composer. Wraps the grounded evidence in a natural reply and states the next step.
Deterministic and offline. It only promises what the system really does (the enquiry is stored, flagged and passed to the team);
it never invents prices, dates or policies - those come only from the cited evidence."""
import re

GREET = re.compile(r"^\s*(hi|hello|hey|good (morning|afternoon|evening)|namaste)\b[\s!.,?]*$", re.I)
THANKS = re.compile(r"^\s*(thanks|thank you|thx|ty|cheers)\b.{0,60}$|\b(that solved my issue|problem solved|works now)\b", re.I)
PRAISE = re.compile(r"\b(congratulations|great job|well done|keep it up|love (it|this|your product))\b", re.I)
IDENT = re.compile(r"\b(who are you|what are you|are you (a )?(real|human|bot|robot)|is this a (real|human) (person|being))\b", re.I)
COMMERCIAL = {"purchase", "demo_request", "pricing", "product_info"}


def small_talk_kind(text: str):
    t = text.strip()
    if GREET.match(t): return "greeting"
    if len(t) <= 90 and (THANKS.search(t) or PRAISE.search(t)): return "thanks"
    if len(t) <= 60 and IDENT.search(t): return "identity"
    return None


def compose_reply(text, intent, ent, rag, tier, small=None):
    name = (ent.get("name") or "").split(" ")[0]
    hi = f"Hi {name}, " if name else ""
    contact = ent.get("email") or ent.get("phone")
    at = f" at {contact}" if contact else ""
    ev = "" if (rag.get("refused") or not rag.get("answer")) else rag["answer"].strip()
    team = ent.get("team_size")
    soon = " as soon as possible" if (ent.get("timeline") or {}).get("label") == "immediate" else ""
    ask = "" if contact or tier == "cold" or intent not in COMMERCIAL else "Could you share your email or phone number so our team can reach you?"
    cap = lambda s: s[:1].upper() + s[1:]
    if small == "greeting":
        return "Hello! I'm the NimbusDesk assistant. I can help with pricing, features, demos and support. What would you like to know?"
    if small == "thanks":
        return "You're welcome! If there's anything else you need, just ask."
    if small == "identity":
        return "I'm NimbusDesk's automated assistant. I answer from our documentation, and I can pass your message to a member of our team whenever you'd like."
    if intent == "complaint":
        return f"{cap(hi)}I'm sorry about your experience. I've escalated your message to a member of our team, who will review it and get back to you{at} as a priority.".replace("  ", " ")
    if intent == "demo_request":
        start = f"{hi}thanks for your interest in NimbusDesk!" if hi else "Thanks for your interest in NimbusDesk!"
        return " ".join(filter(None, [cap(start), ev, f"I've passed your request to our sales team, who will contact you{at} to arrange a demo{soon}.", ask]))
    if intent == "purchase":
        start = f"{hi}great to hear you're ready to move forward!" if hi else "Great to hear you're ready to move forward!"
        return " ".join(filter(None, [cap(start), ev, f"I've marked this as a priority for our sales team, who will follow up{at} with a quote and the next steps.", ask]))
    if intent == "pricing":
        first = ev or "I don't have exact figures for that to hand, so I've passed your question to our sales team."
        nxt = (f"For a team of {team}, our sales team can prepare a tailored quote{at}." if team else "Would you like a tailored quote? Tell us your team size and our sales team will follow up.")
        return " ".join(filter(None, [cap(hi + first) if hi and not ev else first, nxt, ask]))
    if intent == "product_info":
        if not ev:
            return " ".join(filter(None, [cap(hi) + "I couldn't find that in our documentation, so I've passed your question to our team, who will get back to you." if hi else "I couldn't find that in our documentation, so I've passed your question to our team, who will get back to you.", ask]))
        return " ".join(filter(None, [ev, "If you'd like more detail, I can arrange a demo or pass your questions to our team.", ask]))
    if intent == "support":
        return " ".join(filter(None, [f"{hi}sorry to hear you're having trouble." if hi else "Sorry to hear you're having trouble.", ev, f"I've logged this for our support team, who will follow up{at}."])).replace("  ", " ")
    if "appointment" in text.lower() or "book" in text.lower() or "schedule" in text.lower():
        start = f"{hi}I'd be glad to help you schedule that!" if hi else "I'd be glad to help you schedule that!"
        return f"{start} I have noted your request and our team will get in touch to confirm the appointment details and assign the right specialist."
    if ev:
        return ev
    return "I can only help with NimbusDesk products, pricing, demos and support, so I can't help with that. If you have a question about those, just ask, or I can pass your message to our team."
