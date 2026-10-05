-- RA-1: a member of rooms A and B could insert a message with room_id = A and
-- subchannel_id = one of B's channels. It showed up in B, but B's moderators
-- couldn't delete it (DELETE checks is_room_admin(room_id = A)). The insert
-- policy now also requires room_id to be the sub-channel's room.
--
-- Same policy as 20260914_cheapen_hot_rls.sql plus one predicate.
-- Idempotent (DROP IF EXISTS + CREATE), non-destructive. Files only.
DROP POLICY IF EXISTS "messages_insert_member" ON public.messages;
CREATE POLICY "messages_insert_member" ON public.messages FOR INSERT
  WITH CHECK (
    (SELECT auth.uid()) = user_id
    AND is_system = false
    AND room_id = public.subchannel_room_id(subchannel_id)
    AND public.can_post_subchannel(subchannel_id, (SELECT auth.uid()))
  );
