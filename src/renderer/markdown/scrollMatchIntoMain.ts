/**
 * 매칭 element 를 main(스크롤 컨테이너) 의 viewport 중앙으로 부드럽게 scroll. PRD-014.
 *
 * scrollIntoView 대신 main.scrollTo 만 호출하는 이유:
 *
 *   scrollIntoView 의 spec 은 "모든 scrollable ancestor 의 scrollTop 을 조정해 element
 *   가 view 안에 들어오게" 한다. body/html 에 명시 overflow 가 없으면 (default) body 도
 *   scrollable 로 간주되어 page 가 위로 끌려 올라간다 — 탭바가 viewport 밖으로 사라지는
 *   PRD-014 회귀의 원인.
 *
 * 본 helper 는 *오직 main 의 scrollTop 만* 변경하므로 page-level scroll 이 절대 발생하지
 * 않는다. 회귀 가드는 PRD-014 §6 의 두 층 (`html, body { overflow: hidden }` reset + 본
 * helper 호출) 으로 잠금.
 */
export function scrollMatchIntoMain(el: HTMLElement, main: HTMLElement): void {
  const elRect = el.getBoundingClientRect();
  const mainRect = main.getBoundingClientRect();
  const elTopInMain = elRect.top - mainRect.top + main.scrollTop;
  const target = elTopInMain - main.clientHeight / 2 + el.offsetHeight / 2;
  main.scrollTo({ top: Math.max(0, target), behavior: 'smooth' });
}
