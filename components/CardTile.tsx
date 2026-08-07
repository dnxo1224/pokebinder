// 서버 컴포넌트. 카드 한 장을 렌더한다.
// 이미지는 image_base(원본) + '/low.webp' 로 TCGdex CDN 핫링크. (§2-4)
// 타입 색은 이미지 뒤 광원으로만 쓴다 — 카드 아트 자체는 건드리지 않는다.
import FavoriteButton from "./FavoriteButton";
import { auraFor, isRare } from "@/lib/cardStyle";

interface CardTileProps {
  card: {
    id: number;
    name: string;
    local_id: string;
    rarity: string | null;
    category: string;
    image_base: string | null;
    types: string[] | null;
  };
  /** 이미 찜한 카드인지. 부모가 한 번에 조회해 내려준다. */
  favorited?: boolean;
}

export default function CardTile({ card, favorited = false }: CardTileProps) {
  const aura = auraFor(card.types, card.category);
  const rare = isRare(card.rarity);

  return (
    <div className="card-tile" style={{ ["--aura" as string]: aura }}>
      {/* 타입은 TCGdex 의 cards.types 원본. 트레이너/에너지는 types 가 없어 카테고리로 대체.
          레어도는 카드 그림을 가리지 않도록 이미지 위가 아니라 이 줄에 둔다. */}
      <div className="top">
        <span className="cat">
          <span className="swatch" aria-hidden />
          {card.types?.[0] ?? card.category}
        </span>
        {card.rarity && (
          <span className={`rarity${rare ? " rare" : ""}`} title={card.rarity}>
            {card.rarity}
          </span>
        )}
        <span className="num">#{card.local_id}</span>
      </div>

      <div className="imgwrap">
        {card.image_base ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={`${card.image_base}/low.webp`} alt={card.name} loading="lazy" />
        ) : (
          <span className="noimg">이미지 없음</span>
        )}
      </div>

      <div className="body">
        <div className="cname" title={card.name}>
          {card.name}
        </div>
        <div className="cmeta">{card.category}</div>
        <FavoriteButton cardId={card.id} initial={favorited} />
      </div>
    </div>
  );
}
