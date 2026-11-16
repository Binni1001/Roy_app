import { Link } from "@tanstack/react-router";
import { useBootstrapData } from "../hooks/useBootstrapData";
import { useDecideMember, usePendingMembers } from "../hooks/useMemberData";
import { formatDate } from "../lib/format";
import { QueryState } from "./QueryState";
import { confirmDialog } from "../lib/dialog";

/** Thẻ nhỏ ở trang chủ của owner khi có người đang chờ duyệt. */
export function PendingCard() {
  const { role } = useBootstrapData();
  const { data } = usePendingMembers(role === "owner");
  if (!data?.length) return null;
  return (
    <Link to="/quan-tri/duyet" className="card card-link rise d3">
      <h2>Chờ duyệt</h2>
      <p className="big gold">{data.length} người</p>
      <p className="muted">đang xin vào nhóm · chạm để duyệt</p>
    </Link>
  );
}

export function Approvals() {
  const { role, memberships, me } = useBootstrapData();
  const owner = role === "owner";
  const query = usePendingMembers(owner);
  const decide = useDecideMember();
  const group = memberships.find((m) => m.groupId === me?.activeGroupId);

  if (!owner) {
    return (
      <section className="card rise">
        <h1>Duyệt thành viên</h1>
        <p className="muted">Chỉ owner của câu lạc bộ duyệt được yêu cầu vào nhóm.</p>
      </section>
    );
  }

  async function reject(personId: string, name: string) {
    if ((await confirmDialog(`Từ chối ${name}? Nếu người này không còn nhóm nào khác, hồ sơ sẽ chuyển sang đã nghỉ.`))) {
      decide.mutate({ personId, decision: "reject" });
    }
  }

  return (
    <>
      <h1 className="page-title">Duyệt thành viên</h1>
      <QueryState query={query}>
        {(pending) => (
          <section className="card rise">
            <p className="muted small">
              {pending.length
                ? `${pending.length} người xin vào ${group?.groupName ?? "nhóm"}`
                : `Không có ai đang xin vào ${group?.groupName ?? "nhóm"}.`}
            </p>
            {decide.isError && (
              <p className="error" role="alert">
                {decide.error.message}
              </p>
            )}
            {pending.length > 0 && (
              <ul className="rows">
                {pending.map((person) => {
                  const name = person.nickname || person.fullName;
                  const busy = decide.isPending && decide.variables?.personId === person.personId;
                  return (
                    <li className="row approval" key={person.personId}>
                      <div className="grow">
                        <div className="row-title">{person.fullName}</div>
                        <div className="row-sub">
                          {person.email ?? "Chưa có email"} · xin vào {formatDate(person.requestedAt)}
                        </div>
                      </div>
                      <div className="actions">
                        <button
                          className="btn btn-gold btn-small"
                          disabled={decide.isPending}
                          onClick={() => decide.mutate({ personId: person.personId, decision: "approve" })}
                        >
                          {busy && decide.variables?.decision === "approve" ? "Đang duyệt…" : "Duyệt"}
                        </button>
                        <button
                          className="btn btn-dark btn-small"
                          disabled={decide.isPending}
                          onClick={() => reject(person.personId, name)}
                        >
                          Từ chối
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </QueryState>
    </>
  );
}
